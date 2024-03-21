import { JSDOM } from "jsdom";
import MarkdownIt from "markdown-it";
import configuration from "../configuration/config-reader";
import { CommentType, GetActivity } from "../get-activity";
import { GithubComment, Module, Result } from "./processor";

interface Multiplier {
  formattingMultiplier: number;
  wordValue: number;
}

export class FormattingEvaluatorModule implements Module {
  private readonly _configuration: {
    enabled: boolean;
    multipliers: ({ type: (keyof typeof CommentType)[] } & Multiplier)[];
    scores: { [key: string]: number };
  } = configuration.formattingEvaluator;
  private readonly _md = new MarkdownIt();
  private readonly _multipliers: { [k: string]: Multiplier } = {};

  constructor() {
    if (this._configuration.multipliers) {
      this._multipliers = this._configuration.multipliers.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.type.reduce((a, b) => CommentType[b] | a, 0)]: {
            wordValue: curr.wordValue,
            formattingMultiplier: curr.formattingMultiplier,
          },
        };
      }, {});
    }
  }

  transform(data: Readonly<GetActivity>, result: Result) {
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
                acc + curr.score * multiplierFactor.formattingMultiplier * (curr.count * multiplierFactor.wordValue),
              0
            )
          : 0;
        comment.score = {
          ...comment.score,
          formatting: {
            content: formatting,
            ...multiplierFactor,
          },
          reward: comment.score?.reward ? comment.score.reward + formattingTotal : formattingTotal,
        };
      }
    }
    return Promise.resolve(result);
  }

  get enabled(): boolean {
    return this._configuration?.enabled;
  }

  _getFormattingScore(comment: GithubComment) {
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
      let score = 1;
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
