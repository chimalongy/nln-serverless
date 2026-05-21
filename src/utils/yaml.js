const YAML = require('yaml');

function safeParseYAML(yamlText) {
  try {
    if (!yamlText || typeof yamlText !== 'string') {
      throw new Error('Input is not a string');
    }

    // 🧹 Step 1: Remove markdown code fences and invisible markers
    let cleaned = yamlText
      .replace(/^```yaml\s*/i, '')
      .replace(/```$/i, '')
      .replace(/```<.*?>/g, '') // removes ```<｜begin▁of▁sentence｜> type
      .replace(/<\｜.*?\｜>/g, '') // removes OpenRouter/DeepSeek markers
      .trim();

    // 🧹 Step 2: Remove stray characters sometimes added at the end
    cleaned = cleaned.replace(/[`]+.*$/g, '').trim();

    // 🧹 Step 3: Ensure content field with `|` preserves indentation properly
    cleaned = cleaned.replace(/\r/g, '');

    // 🧠 Step 4: Parse
    const parsed = YAML.parse(cleaned);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Parsed YAML is not a valid object');
    }

    return parsed;
  } catch (error) {
    console.error('❌ YAML parsing failed:', error.message);
    return null;
  }
}

module.exports = {
  safeParseYAML,
};
