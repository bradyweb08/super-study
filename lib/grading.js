function baseNormalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stripParentheticalDetails(value) {
  return value.replace(/\s*[\(\[\{][^)\]\}]*[\)\]\}]\s*/g, " ");
}

function flexibleNormalize(value) {
  return baseNormalize(stripParentheticalDetails(value))
    .replace(/&/g, " and ")
    .replace(/[-–—_]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(left, right) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
    }

    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
}

function closeEnough(response, target) {
  if (response.length < 5 || target.length < 5) return false;

  const distance = editDistance(response, target);
  const longest = Math.max(response.length, target.length);
  const maxDistance = longest >= 18 ? 2 : 1;

  return distance <= maxDistance;
}

export function normalizeForGrading(value, strictness) {
  if (strictness === "strict") return baseNormalize(value);
  return flexibleNormalize(value);
}

export function isTypedCorrect(answer, expected, strictness = "flexible") {
  const response = normalizeForGrading(answer, strictness);
  const target = normalizeForGrading(expected, strictness);

  if (!response || !target) return false;
  if (response === target) return true;

  return strictness === "lenient" && closeEnough(response, target);
}

export const gradingOptions = [
  {
    value: "strict",
    label: "Strict",
    description: "Ignores capitalization and extra spaces."
  },
  {
    value: "flexible",
    label: "Flexible",
    description: "Also ignores punctuation, dashes, parentheses, and & versus and."
  },
  {
    value: "lenient",
    label: "Lenient",
    description: "Also allows small typos and ignores parenthetical details."
  }
];
