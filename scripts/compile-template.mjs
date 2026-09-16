import fs from 'node:fs';
import nunjucks from 'nunjucks';
// Jinja's namespace assignment is the only syntax adaptation needed here.
const source = fs.readFileSync('templates/partials/_github.html', 'utf8')
  .replace('{% set ns = namespace(offset=0) %}', '{% set offset = 0 %}')
  .replaceAll('ns.offset', 'offset')
  .replace("github.languages[:6]", "github.languages | sliceFirst(6)");
const compiled = nunjucks.precompileString(source, {name: 'github'});
fs.writeFileSync('.generated/github-template.mjs',
  'const window = {};\n' + compiled + '\nexport default window.nunjucksPrecompiled.github;\n');
