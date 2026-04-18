function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function splitOnLastSpacedDash(line) {
  const matches = [...line.matchAll(/\s[-–—]\s/g)];
  const delimiter = matches.at(-1);

  if (!delimiter) return [];

  const delimiterStart = delimiter.index;
  const delimiterEnd = delimiterStart + delimiter[0].length;
  return [line.slice(0, delimiterStart).trim(), line.slice(delimiterEnd).trim()];
}

export function parseCards(input, format = "auto") {
  const lines = String(input || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const cards = [];

  for (const [index, line] of lines.entries()) {
    let parts = [];

    if (format === "csv") {
      parts = parseCsvLine(line);
    }

    if (parts.length < 2 && line.includes("\t")) {
      parts = line.split("\t");
    }

    if (parts.length < 2) {
      parts = splitOnLastSpacedDash(line);
    }

    if (parts.length < 2 && line.includes(": ")) {
      const separatorIndex = line.indexOf(": ");
      parts = [line.slice(0, separatorIndex), line.slice(separatorIndex + 2)];
    }

    if (parts.length < 2 && format === "auto" && line.includes(",")) {
      parts = parseCsvLine(line);
    }

    if (parts.length >= 2) {
      const [term, ...definitionParts] = parts;
      const definition = definitionParts.join(format === "csv" ? ", " : " ").trim();
      const looksLikeHeader = index === 0 && /^term$/i.test(term.trim()) && /^definition$/i.test(definition);
      if (looksLikeHeader) continue;
      if (term.trim() && definition) {
        cards.push({ term: term.trim(), definition });
      }
    }
  }

  return cards;
}
