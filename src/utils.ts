function paramsToObject(entries) {
  const result = {}
  // each 'entry' is a [key, value] tupple
  for (const [key, value] of entries) {
    result[key] = value;
  }
  return result;
}
// In src/utils.ts or at the top of src/main.ts
function fixSpacing(input: string): string {
  // Remove all spaces.
  let output = input.replace(/\s+/g, "");
  // Add a space before every backslash.
  output = output.replace(/\\/g, " \\");
  // Add a space before and after every plus, minus, and equal sign.
  output = output.replace(/([\+\-\=])/g, " $1 ");
  // want a space after div, approx, and times only if not followed by a space
  output = output.replace(/(\\?)(div|approx|times|Delta)(?!\s)/g, "$1$2 ");
  // Collapse multiple spaces into one.
  output = output.replace(/\s+/g, " ");
  return output;
}



export { paramsToObject, fixSpacing }