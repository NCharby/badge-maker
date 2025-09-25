const mustache = require('mustache');

// Test data
const testData = {
  badgeName: 'Test Badge',
  decorations: {
    frills: { left: true, right: true, lower: true }
  }
};

// Template
const template = '<div>{{#decorations.frills}}{{> frill-elements }}{{/decorations.frills}}</div>';

// Partials
const partials = {
  'frill-elements': `
    {{#left}}LEFT FRILL{{/left}}
    {{#right}}RIGHT FRILL{{/right}}
    {{#lower}}LOWER FRILL{{/lower}}
  `
};

// Render
const rendered = mustache.render(template, testData, partials);
console.log('Rendered:', rendered);
