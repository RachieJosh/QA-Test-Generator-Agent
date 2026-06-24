require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function generateTestCasesFromText(featureDescription) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: `You are an expert QA Engineer. When given a feature description, you will:
1. Identify all the flows that need to be tested
2. Generate structured test cases for each flow
3. Include positive, negative and edge cases
Be specific, professional and thorough.`,
    messages: [
      { role: 'user', content: `Generate test cases for this feature: ${featureDescription}` }
    ]
  });
  return response.content[0].text;
}

async function generateTestCasesFromImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const extension = path.extname(imagePath).toLowerCase();

  const mediaTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };

  const mediaType = mediaTypes[extension] || 'image/png';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: `You are an expert QA Engineer. When given a UI screenshot or Figma design, you will:
1. Analyze all visible UI elements, flows, buttons, forms and states
2. Identify all the flows that need to be tested
3. Generate structured test cases for each flow
4. Include positive, negative and edge cases
Be specific, professional and thorough.`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
        { type: 'text', text: 'Analyze this UI design and generate comprehensive test cases for it.' }
      ]
    }]
  });

  return response.content[0].text;
}

function askQuestion() {
  console.log('\n🤖 QA Test Generator Agent');
  console.log('─────────────────────────────');
  console.log('1. Type a feature description');
  console.log('2. Type "image" to analyze a screenshot');
  console.log('3. Type "exit" to quit');
  console.log('─────────────────────────────');

  rl.question('> ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      console.log('👋 QA Agent shutting down. Goodbye!');
      rl.close();
      return;
    }

    if (input.toLowerCase() === 'image') {
      rl.question('\n📁 Enter the full path to your image:\n> ', async (imagePath) => {
        if (!fs.existsSync(imagePath)) {
          console.log('❌ Image not found! Check the path and try again.');
          askQuestion();
          return;
        }
        console.log('\n⏳ Analyzing image and generating test cases...\n');
        try {
          const result = await generateTestCasesFromImage(imagePath);
          console.log('✅ Generated Test Cases:\n');
          console.log(result);
          askQuestion();
        } catch (error) {
          console.log('❌ Error:', error.message);
          askQuestion();
        }
      });
      return;
    }

    if (!input.trim()) {
      console.log('⚠️  Please enter something!');
      askQuestion();
      return;
    }

    console.log('\n⏳ Generating test cases...\n');

    try {
      const result = await generateTestCasesFromText(input);
      console.log('✅ Generated Test Cases:\n');
      console.log(result);
      askQuestion();
    } catch (error) {
      console.log('❌ Error:', error.message);
      askQuestion();
    }
  });
}

console.log('🔥 QA Test Generator Agent Started!');
console.log('💡 Describe a feature OR drop a Figma screenshot!');
askQuestion();