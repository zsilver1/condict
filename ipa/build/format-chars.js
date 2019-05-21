module.exports = chars => chars.map(char => ({
  input: char.input,
  display: char.display,
  name: char.name,
  nameWords: char.name.split(/\s+/),
}));
