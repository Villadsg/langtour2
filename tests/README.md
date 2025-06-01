# Language Learning Tour Conversation Recorder

This directory contains Playwright tests designed to help you record and manually review AI-generated conversations for language learning tours.

## Purpose

These tests simulate user interactions with your AI tour creation form, focusing specifically on language learning tours. The tests:

1. Record complete conversations between users and the AI
2. Save them in human-readable format for manual review
3. Take screenshots of the final state of the form
4. Store all data in the `conversation-logs` directory

## How to Use

### Prerequisites

1. Install Playwright and its dependencies:
```bash
npm install
npx playwright install chromium
```

### Running the Tests

To record language learning tour conversations:

```bash
npm run record-conversations
```

This will run all the test scenarios in `language-tour-conversation-recorder.spec.ts`.

### Test Scenarios

The test file includes three language learning tour scenarios:

1. **German Business Vocabulary Tour**: A B1-level tour in Berlin focusing on business German
2. **Spanish Food Vocabulary Tour**: An A2-level tour in Barcelona focusing on food vocabulary
3. **French Art Vocabulary Tour**: A B1-level tour in Paris focusing on art-related vocabulary

Each scenario simulates a multi-turn conversation with the AI, providing increasingly specific details about the language learning focus.

### Reviewing the Conversations

After running the tests, check the `conversation-logs` directory for:

- Text files (`.txt`) with human-readable conversation logs
- JSON files (`.json`) with structured conversation data
- Screenshots (`.png`) showing the final state of the form

### Manual Analysis Process

For each conversation, consider:

1. **Language Learning Focus**:
   - Does the AI ask about language proficiency levels (A1-C2)?
   - Does it inquire about specific vocabulary focus?
   - Does it clarify which language the tour will be taught in vs. which language is being learned?

2. **Conversation Quality**:
   - Is the AI's language natural and conversational?
   - Does it acknowledge the language learning context?
   - Does it suggest specific language learning activities?

3. **Information Extraction**:
   - Does the AI correctly extract the language being taught?
   - Does it identify the proficiency level?
   - Does it capture vocabulary focus areas?

### Making Improvements

Based on your manual review:

1. Identify patterns of issues in the AI's responses
2. Modify the prompts in `geminiService.ts` to address these issues
3. Run the tests again to verify improvements
4. Repeat until satisfied with the conversation quality

## Customizing the Tests

You can modify `language-tour-conversation-recorder.spec.ts` to:

- Add new language learning scenarios
- Change the specific details in existing scenarios
- Adjust the conversation flow
- Modify the waiting times between messages

## Tips for Effective Manual Review

- Focus on one aspect at a time (e.g., first review language proficiency handling, then vocabulary focus)
- Compare conversations across different language scenarios to identify inconsistencies
- Look for missed opportunities where the AI could have asked for more language-specific details
- Check if the AI is properly distinguishing between the language being taught and the language of instruction
