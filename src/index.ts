import type { Token as JSToken, JSXToken } from "js-tokens";
import jsTokens from "js-tokens";
import {
  isStrictReservedWord,
  isKeyword,
} from "@babel/helper-validator-identifier";
import kleur from "kleur";

/**
 * Names that are always allowed as identifiers, but also appear as keywords
 * within certain syntactic productions.
 *
 * https://tc39.es/ecma262/#sec-keywords-and-reserved-words
 *
 * `target` has been omitted since it is very likely going to be a false
 * positive.
 */
const sometimesKeywords = new Set(["as", "async", "from", "get", "of", "set"]);

type InternalTokenType =
  | "keyword"
  | "capitalized"
  | "jsxIdentifier"
  | "punctuator"
  | "number"
  | "string"
  | "regex"
  | "comment"
  | "invalid";

type Token = {
  type: InternalTokenType | "uncolored";
  value: string;
};

/**
 * Kleur styles for token types.
 */
function getDefs(): Record<InternalTokenType, (str: string) => string> {
  return {
    keyword: kleur.cyan,
    capitalized: kleur.yellow,
    jsxIdentifier: kleur.yellow,
    punctuator: kleur.yellow,
    number: kleur.magenta,
    string: kleur.green,
    regex: kleur.magenta,
    comment: kleur.grey,
    invalid: kleur.white().bgRed().bold,
  };
}

/**
 * RegExp to test for newlines in terminal.
 */
const NEWLINE = /\r\n|[\n\r\u2028\u2029]/;

/**
 * RegExp to test for the three types of brackets.
 */
const BRACKET = /^[()[\]{}]$/;

/**
 * Get the type of token, specifying punctuator type.
 */
const getTokenType = function (
  token: JSToken | JSXToken,
): InternalTokenType | "uncolored" {
  if (token.type === "IdentifierName") {
    if (
      isKeyword(token.value) ||
      isStrictReservedWord(token.value, true) ||
      sometimesKeywords.has(token.value)
    ) {
      return "keyword";
    }

    if (token.value[0] !== token.value[0].toLowerCase()) {
      return "capitalized";
    }
  }

  if (token.type === "Punctuator" && BRACKET.test(token.value)) {
    return "uncolored";
  }

  if (token.type === "Invalid" && token.value === "@") {
    return "punctuator";
  }

  switch (token.type) {
    case "NumericLiteral":
      return "number";

    case "StringLiteral":
    case "JSXString":
    case "NoSubstitutionTemplate":
      return "string";

    case "RegularExpressionLiteral":
      return "regex";

    case "Punctuator":
    case "JSXPunctuator":
      return "punctuator";

    case "MultiLineComment":
    case "SingleLineComment":
      return "comment";

    case "Invalid":
    case "JSXInvalid":
      return "invalid";

    case "JSXIdentifier":
      return "jsxIdentifier";

    default:
      return "uncolored";
  }
};

/**
 * Turn a string of JS into an array of objects.
 */
const tokenize = function* (text: string): Generator<Token> {
  for (const token of jsTokens(text, { jsx: true })) {
    switch (token.type) {
      case "TemplateHead":
        yield { type: "string", value: token.value.slice(0, -2) };
        yield { type: "punctuator", value: "${" };
        break;

      case "TemplateMiddle":
        yield { type: "punctuator", value: "}" };
        yield { type: "string", value: token.value.slice(1, -2) };
        yield { type: "punctuator", value: "${" };
        break;

      case "TemplateTail":
        yield { type: "punctuator", value: "}" };
        yield { type: "string", value: token.value.slice(1) };
        break;

      default:
        yield {
          type: getTokenType(token),
          value: token.value,
        };
    }
  }
};

/**
 * Highlight `text` using the token definitions in `defs`.
 */
function highlightTokens(
  defs: Record<string, (str: string) => string>,
  text: string,
) {
  let highlighted = "";

  for (const { type, value } of tokenize(text)) {
    const colorize = defs[type];
    if (colorize) {
      highlighted += value
        .split(NEWLINE)
        .map((str) => colorize(str))
        .join("\n");
    } else {
      highlighted += value;
    }
  }

  return highlighted;
}

type Options = {
  forceColor?: boolean;
};

/**
 * Highlight `code`.
 */
export default function highlight(code: string, options: Options = {}): string {
  if (code === "") {
    return code;
  }

  if (options.forceColor) {
    const kleurEnabledBefore = kleur.enabled;
    kleur.enabled = true;
    let result: string;
    try {
      result = highlightTokens(getDefs(), code);
    } finally {
      kleur.enabled = kleurEnabledBefore;
    }
    return result;
  } else if (kleur.enabled) {
    return highlightTokens(getDefs(), code);
  } else {
    return code;
  }
}