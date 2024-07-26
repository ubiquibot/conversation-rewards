import { Value } from "@sinclair/typebox/value";
import Decimal from "decimal.js";
import { JSDOM } from "jsdom";
import MarkdownIt from "markdown-it";
import { commentEnum, CommentType } from "../configuration/comment-types";
import configuration from "../configuration/config-reader";
import {
  FormattingEvaluatorConfiguration,
  formattingEvaluatorConfigurationType,
} from "../configuration/formatting-evaluator-config";
import logger from "../helpers/logger";
import { IssueActivity } from "../issue-activity";
import { GithubCommentScore, Module, Result } from "./processor";

interface Multiplier {
  formattingMultiplier: number;
  scores: FormattingEvaluatorConfiguration["multipliers"][0]["scores"];
  symbols: FormattingEvaluatorConfiguration["multipliers"][0]["symbols"];
}

export class FormattingEvaluatorModule implements Module {
  private readonly _configuration: FormattingEvaluatorConfiguration | null =
    configuration.incentives.formattingEvaluator;
  private readonly _md = new MarkdownIt();
  private readonly _multipliers: { [k: number]: Multiplier } = {};

  _getEnumValue(key: CommentType) {
    let res = 0;

    key.split("_").forEach((value) => {
      res |= Number(commentEnum[value as keyof typeof commentEnum]);
    });
    return res;
  }

  constructor() {
    if (this._configuration?.multipliers) {
      this._multipliers = this._configuration.multipliers.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.select.reduce((a, b) => this._getEnumValue(b) | a, 0)]: {
            symbols: curr.symbols,
            formattingMultiplier: curr.formattingMultiplier,
            scores: curr.scores,
          },
        };
      }, {});
    }
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments || [];
      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        // Count with html elements if any, otherwise just treat it as plain text
        const { formatting } = this._getFormattingScore(comment);
        const multiplierFactor = this._multipliers?.[comment.type] ?? { wordValue: 0, formattingMultiplier: 0 };
        const formattingTotal = formatting
          ? Object.values(formatting).reduce((acc, curr) => {
              let sum = new Decimal(0);
              for (const symbol of Object.keys(curr.symbols)) {
                sum = sum.add(
                  new Decimal(curr.symbols[symbol].count)
                    .mul(curr.symbols[symbol].multiplier)
                    .mul(multiplierFactor.formattingMultiplier)
                    .mul(curr.score)
                );
              }
              return acc.add(sum);
            }, new Decimal(0))
          : new Decimal(0);
        comment.score = {
          ...comment.score,
          formatting: {
            content: formatting,
            formattingMultiplier: multiplierFactor.formattingMultiplier,
          },
          reward: (comment.score?.reward ? formattingTotal.add(comment.score.reward) : formattingTotal).toNumber(),
        };
      }
    }
    return result;
  }

  get enabled(): boolean {
    if (!Value.Check(formattingEvaluatorConfigurationType, this._configuration)) {
      console.warn("Invalid / missing configuration detected for FormattingEvaluatorModule, disabling.");
      return false;
    }
    return true;
  }

  _getFormattingScore(comment: GithubCommentScore) {
    const html = this._md.render(comment.content);
    const temp = new JSDOM(html);
    if (temp.window.document.body) {
      const res = this.classifyTagsWithWordCount(temp.window.document.body, comment.type);
      return { formatting: res };
    } else {
      throw new Error(`Could not create DOM for comment [${comment}]`);
    }
  }

  _countWords(symbols: FormattingEvaluatorConfiguration["multipliers"][0]["symbols"], text: string) {
    const counts: { [p: string]: { count: number; multiplier: number } } = {};
    for (const [regex, multiplier] of Object.entries(symbols)) {
      const match = text.trim().match(new RegExp(regex, "g"));
      counts[regex] = {
        count: match?.length || 1,
        multiplier,
      };
    }
    return counts;
  }

  classifyTagsWithWordCount(htmlElement: HTMLElement, commentType: GithubCommentScore["type"]) {
    const tagWordCount: Record<
      string,
      { symbols: { [p: string]: { count: number; multiplier: number } }; score: number }
    > = {};
    const elements = htmlElement.getElementsByTagName("*");

    for (const element of elements) {
      const tagName = element.tagName.toLowerCase();
      const wordCount = this._countWords(this._multipliers[commentType].symbols, element.textContent || "");
      let score = 1;
      if (this._multipliers[commentType]?.scores[tagName] !== undefined) {
        score = this._multipliers[commentType].scores[tagName];
      } else {
        logger.error(`Could not find multiplier for comment [${commentType}], <${tagName}>`);
      }
      tagWordCount[tagName] = {
        symbols: wordCount,
        score,
      };
    }

    return tagWordCount;
  }
}
