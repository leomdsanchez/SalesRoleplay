#!/usr/bin/env node

// Test script for TTS functionality
const { textToSpeech } = require('./server/voice/tts.ts');

async function testTTS() {
  console.log("🧪 Testing TTS functionality...");

  try {
    // Test with default model
    console.log("Testing tts-1 model...");
    const buffer1 = await textToSpeech("Hello world", "alloy", "tts-1");
    console.log(`✅ tts-1: ${buffer1.length} bytes`);

    // Test with HD model
    console.log("Testing tts-1-hd model...");
    const buffer2 = await textToSpeech("Hello world", "alloy", "tts-1-hd");
    console.log(`✅ tts-1-hd: ${buffer2.length} bytes`);

    // Test with gpt-4o-mini-tts (should fallback)
    console.log("Testing gpt-4o-mini-tts model (should fallback)...");
    const buffer3 = await textToSpeech("Hello world", "alloy", "gpt-4o-mini-tts");
    console.log(`✅ gpt-4o-mini-tts (fallback): ${buffer3.length} bytes`);

    console.log("🎉 All TTS models working correctly!");
  } catch (error) {
    console.error("❌ TTS test failed:", error.message);
    process.exit(1);
  }
}

testTTS();
