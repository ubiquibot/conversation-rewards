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
import { IssueActivity } from "../issue-activity";
import { GithubCommentScore, Module, Result } from "./processor";

interface Multiplier {
  formattingMultiplier: number;
  wordValue: number;
}

export class FormattingEvaluatorModule implements Module {
  private readonly _configuration: FormattingEvaluatorConfiguration | null =
    configuration.incentives.formattingEvaluator;
  private readonly _md = new MarkdownIt();
  private readonly _multipliers: { [k: string]: Multiplier } = {};

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
            wordValue: curr.wordValue,
            formattingMultiplier: curr.formattingMultiplier,
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
          ? Object.values(formatting).reduce(
              (acc, curr) =>
                acc.add(
                  new Decimal(curr.score)
                    .mul(multiplierFactor.formattingMultiplier)
                    .mul(curr.count)
                    .mul(multiplierFactor.wordValue)
                ),
              new Decimal(0)
            )
          : new Decimal(0);
        comment.score = {
          ...comment.score,
          formatting: {
            content: formatting,
            ...multiplierFactor,
          },
          reward: (comment.score?.reward ? formattingTotal.add(comment.score.reward) : formattingTotal).toNumber(),
        };
      }
    }
    return result;
  }

  get enabled(): boolean {
    if (!Value.Check(formattingEvaluatorConfigurationType, this._configuration)) {
      console.warn("Invalid configuration detected for FormattingEvaluatorModule, disabling.");
      return false;
    }
    return true;
  }

  _getFormattingScore(comment: GithubCommentScore) {
    const html = this._md.render(comment.content);
    const temp = new JSDOM(html);
    if (temp.window.document.body) {
      const res = this.classifyTagsWithWordCount(temp.window.document.body);
      return { formatting: res };
    } else {
      throw new Error(`Could not create DOM for comment [${comment}]`);
    }
  }

  _countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  classifyTagsWithWordCount(htmlElement: HTMLElement) {
    const tagWordCount: Record<string, { count: number; score: number }> = {};
    const elements = htmlElement.getElementsByTagName("*");

    for (const element of elements) {
      const tagName = element.tagName.toLowerCase();
      const wordCount = this._countWords(element.textContent || "");
      let score = 0;
      if (this._configuration?.scores?.[tagName] !== undefined) {
        score = this._configuration.scores[tagName];
      }
      tagWordCount[tagName] = {
        count: (tagWordCount[tagName]?.count || 0) + wordCount,
        score,
      };
    }

    return tagWordCount;
  }
}
