import Decimal from "decimal.js";
import OpenAI from "openai";
import configuration from "../configuration/config-reader";
import { OPENAI_API_KEY } from "../configuration/constants";
import {
  ContentEvaluatorConfiguration,
  contentEvaluatorConfigurationType,
} from "../configuration/content-evaluator-config";
import { IssueActivity } from "../issue-activity";
import { GithubCommentScore, Module, Result } from "./processor";
import { Value } from "@sinclair/typebox/value";
import { commentEnum, CommentKind, CommentType } from "../configuration/comment-types";
import logger from "../helpers/logger";
import {
  AllComments,
  CommentToEvaluate,
  openAiRelevanceResponseSchema,
  PrCommentToEvaluate,
  Relevances,
} from "../types/content-evaluator-module-type";
import { encodingForModel } from "js-tiktoken";

/**
 * Evaluates and rates comments.
 */
export class ContentEvaluatorModule implements Module {
  readonly _configuration: ContentEvaluatorConfiguration | null = configuration.incentives.contentEvaluator;
  readonly _openAi = new OpenAI({
    apiKey: OPENAI_API_KEY,
    ...(this._configuration?.openAi.endpoint && { baseURL: this._configuration.openAi.endpoint }),
  });
  private readonly _fixedRelevances: { [k: string]: number } = {};

  _getEnumValue(key: CommentType) {
    let res = 0;

    key.split("_").forEach((value) => {
      res |= Number(commentEnum[value as keyof typeof commentEnum]);
    });
    return res;
  }

  constructor() {
    if (this._configuration?.multipliers) {
      this._fixedRelevances = this._configuration.multipliers.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.role.reduce((a, b) => this._getEnumValue(b) | a, 0)]: curr.relevance,
        };
      }, {});
    }
  }

  get enabled(): boolean {
    if (!Value.Check(contentEvaluatorConfigurationType, this._configuration)) {
      console.warn("Invalid / missing configuration detected for ContentEvaluatorModule, disabling.");
      return false;
    }
    return true;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    const promises: Promise<GithubCommentScore[]>[] = [];
    const allCommentsUnClean = data.allComments || [];
    const allComments: { id: number; comment: string; author: string }[] = [];
    for (const commentObj of allCommentsUnClean) {
      if (commentObj.user) {
        allComments.push({ id: commentObj.id, comment: commentObj.body ?? "", author: commentObj.user.login });
      }
    }

    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments ?? [];
      const specificationBody = data.self?.body;
      if (specificationBody && comments.length) {
        promises.push(
          this._processComment(comments, specificationBody, allComments).then(
            (commentsWithScore) => (currentElement.comments = commentsWithScore)
          )
        );
      }
    }

    await Promise.all(promises);
    return result;
  }

  _getRewardForComment(comment: GithubCommentScore, relevance: number) {
    let reward = new Decimal(comment?.score?.reward ?? 0);

    if (comment?.score?.formatting && comment.score.multiplier && comment.score.words) {
      let totalRegexReward = new Decimal(0);
      totalRegexReward = totalRegexReward.add(comment.score.words.result);
      totalRegexReward = totalRegexReward.mul(comment.score.multiplier);
      const totalRegexRewardWithRelevance = totalRegexReward.mul(relevance);
      reward = reward.sub(totalRegexReward).add(totalRegexRewardWithRelevance);
    }
    return reward;
  }

  async _processComment(comments: Readonly<GithubCommentScore>[], specificationBody: string, allComments: AllComments) {
    const commentsWithScore: GithubCommentScore[] = [...comments];
    const { commentsToEvaluate, prCommentsToEvaluate } = this._splitCommentsByPrompt(commentsWithScore);

    const relevancesByAi = await this._evaluateComments(
      specificationBody,
      commentsToEvaluate,
      allComments,
      prCommentsToEvaluate
    );

    if (Object.keys(relevancesByAi).length !== commentsToEvaluate.length + prCommentsToEvaluate.length) {
      throw logger.fatal("Relevance / Comment length mismatch!", { relevancesByAi, commentsToEvaluate });
    }

    for (const currentComment of commentsWithScore) {
      let currentRelevance = 1; // For comments not in fixed relevance types and missed by OpenAI evaluation
      if (this._fixedRelevances[currentComment.type]) {
        currentRelevance = this._fixedRelevances[currentComment.type];
      } else if (!isNaN(relevancesByAi[currentComment.id])) {
        currentRelevance = relevancesByAi[currentComment.id];
      }

      const currentReward = this._getRewardForComment(currentComment, currentRelevance);

      currentComment.score = {
        ...(currentComment.score || { multiplier: 0 }),
        relevance: new Decimal(currentRelevance).toNumber(),
        reward: currentReward.toNumber(),
      };
    }

    return commentsWithScore;
  }

  /**
   * Will try to predict the maximum of tokens expected, to a maximum of totalTokenLimit.
   */
  _calculateMaxTokens(prompt: string, totalTokenLimit: number = 16384) {
    const tokenizer = encodingForModel("gpt-4o-2024-08-06");
    const inputTokens = tokenizer.encode(prompt).length;
    return Math.min(inputTokens, totalTokenLimit);
  }

  _generateDummyResponse(comments: { id: number; comment: string }[]) {
    return comments.reduce<Record<string, number>>((acc, curr) => {
      return { ...acc, [curr.id]: 0.5 };
    }, {});
  }

  _splitCommentsByPrompt(commentsWithScore: Readonly<GithubCommentScore>[]): {
    commentsToEvaluate: CommentToEvaluate[];
    prCommentsToEvaluate: PrCommentToEvaluate[];
  } {
    const commentsToEvaluate: CommentToEvaluate[] = [];
    const prCommentsToEvaluate: PrCommentToEvaluate[] = [];
    for (const currentComment of commentsWithScore) {
      if (!this._fixedRelevances[currentComment.type]) {
        if (currentComment.type & CommentKind.PULL) {
          prCommentsToEvaluate.push({
            id: currentComment.id,
            comment: currentComment.content,
            diffHunk: currentComment?.diffHunk,
          });
        } else {
          commentsToEvaluate.push({
            id: currentComment.id,
            comment: currentComment.content,
          });
        }
      }
    }
    return { commentsToEvaluate, prCommentsToEvaluate };
  }

  async _evaluateComments(
    specification: string,
    comments: CommentToEvaluate[],
    allComments: AllComments,
    prComments: PrCommentToEvaluate[]
  ): Promise<Relevances> {
    let commentRelevances: Relevances = {};
    let prCommentRelevances: Relevances = {};

    if (comments.length) {
      const dummyResponse = JSON.stringify(this._generateDummyResponse(comments), null, 2);
      const maxTokens = this._calculateMaxTokens(dummyResponse);

      const promptForComments = this._generatePromptForComments(specification, comments, allComments);
      commentRelevances = await this._submitPrompt(promptForComments, maxTokens);
    }

    if (prComments.length) {
      const dummyResponse = JSON.stringify(this._generateDummyResponse(prComments), null, 2);
      const maxTokens = this._calculateMaxTokens(dummyResponse);

      const promptForPrComments = this._generatePromptForPrComments(specification, prComments);
      prCommentRelevances = await this._submitPrompt(promptForPrComments, maxTokens);
    }

    return { ...commentRelevances, ...prCommentRelevances };
  }

  async _submitPrompt(prompt: string, maxTokens: number): Promise<Relevances> {
    const response: OpenAI.Chat.ChatCompletion = await this._openAi.chat.completions.create({
      model: this._configuration?.openAi.model ?? "gpt-4o-2024-08-06",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      top_p: 1,
      temperature: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const rawResponse = String(response.choices[0].message.content);
    logger.info(`OpenAI raw response (using max_tokens: ${maxTokens}): ${rawResponse}`);

    const jsonResponse = JSON.parse(rawResponse);

    try {
      const relevances = Value.Decode(openAiRelevanceResponseSchema, jsonResponse);
      logger.info(`Relevances by OpenAI: ${JSON.stringify(relevances)}`);
      return relevances;
    } catch (e) {
      logger.error(`Invalid response type received from openai while evaluating: ${jsonResponse} \n\nError: ${e}`);
      throw new Error("Error in evaluation by OpenAI.");
    }
  }

  _generatePromptForComments(issue: string, comments: CommentToEvaluate[], allComments: AllComments) {
    if (!issue?.length) {
      throw new Error("Issue specification comment is missing or empty");
    }
    return `Instruction: 
    Start by thoroughly reading all comments and retaining their content for the evaluation.

    OUTPUT FORMAT:
    Provide a JSON object with the format: {ID: CONNECTION_SCORE} for each record in the evaluation section. 
    The CONNECTION_SCORE should reflect the average relevance based on all comments, title, and body.

    GLOBAL CONTEXT:
    Specification
    "${issue}"
    
    ALL COMMENTS:
    ${JSON.stringify(allComments, null, 2)}
    
    IMPORTANT CONTEXT:
    Consider all comments when evaluating connections. Relevant comments may appear before or after the comment being evaluated, so examine all of them closely.
    
    START EVALUATING:
    ${JSON.stringify(comments, null, 2)}

    POST EVALUATION:
    Provide only the connection scores as floating-point values indicating the relevance of each comment based on its connection to the overall context.

    SCORING CRITERIA:
    Assign scores from 0 to 1, 0: Not related (e.g., spam), 1: Highly relevant (e.g., solutions, bugs)
    Consider the context of all comments; even minor details may be significant for resolving the issue. If a comment is unrelated to all comments, title, or issue specification, assign a score of 0.

    OUTPUT:
    Return a JSON object containing the ID and the connection score for each evaluated comment. The number of entries in the JSON response must match exactly ${comments.length}.
    `;
  }

  _generatePromptForPrComments(issue: string, comments: PrCommentToEvaluate[]) {
    if (!issue?.length) {
      throw new Error("Issue specification comment is missing or empty");
    }
    return `I need to evaluate the value of a GitHub contributor's comments in a pull request. Some of these comments are code review comments, and some are general suggestions or a part of the discussion. I'm interested in how much each comment helps to solve the GitHub issue and improve code quality. Please provide a float between 0 and 1 to represent the value of each comment. A score of 1 indicates that the comment is very valuable and significantly improves the submitted solution and code quality, whereas a score of 0 indicates a negative or zero impact. A stringified JSON is given below that contains the specification of the GitHub issue, and comments by different contributors. The property "diffHunk" presents the chunk of code being addressed for a possible change in a code review comment. \n\n\`\`\`\n${JSON.stringify(
      { specification: issue, comments: comments }
    )}\n\`\`\`\n\n\nTo what degree are each of the comments valuable? Please reply with ONLY a JSON where each key is the comment ID given in JSON above, and the value is a float number between 0 and 1 corresponding to the comment. The float number should represent the value of the comment for improving the issue solution and code quality. The total number of properties in your JSON response should equal exactly ${
      comments.length
    }.`;
  }
}
