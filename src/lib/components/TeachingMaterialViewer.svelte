<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TourStop, TeachingMaterial, VocabularyItem, Dialogue } from '$lib/firebase/types';

  export let stop: TourStop;
  export let isEditing = false;

  const dispatch = createEventDispatcher();

  // Expansion state
  let vocabularyExpanded = true;
  let dialoguesExpanded = true;

  // Get teaching material
  $: material = stop.teachingMaterial;

  // Edit handlers
  function updateVocabularyItem(index: number, field: keyof VocabularyItem, value: string) {
    if (!material) return;

    const updatedVocabulary = [...material.vocabulary];
    updatedVocabulary[index] = { ...updatedVocabulary[index], [field]: value };

    dispatch('update', {
      stopId: stop.id,
      teachingMaterial: { ...material, vocabulary: updatedVocabulary }
    });
  }

  function deleteVocabularyItem(index: number) {
    if (!material) return;

    const updatedVocabulary = material.vocabulary.filter((_, i) => i !== index);

    dispatch('update', {
      stopId: stop.id,
      teachingMaterial: { ...material, vocabulary: updatedVocabulary }
    });
  }

  function addVocabularyItem() {
    if (!material) return;

    const newItem: VocabularyItem = {
      word: '',
      translation: '',
      pronunciation: '',
      context: ''
    };

    dispatch('update', {
      stopId: stop.id,
      teachingMaterial: { ...material, vocabulary: [...material.vocabulary, newItem] }
    });
  }

  function updateDialogueLine(dialogueIndex: number, lineIndex: number, field: string, value: string) {
    if (!material) return;

    const updatedDialogues = [...material.dialogues];
    const updatedLines = [...updatedDialogues[dialogueIndex].lines];
    updatedLines[lineIndex] = { ...updatedLines[lineIndex], [field]: value };
    updatedDialogues[dialogueIndex] = { ...updatedDialogues[dialogueIndex], lines: updatedLines };

    dispatch('update', {
      stopId: stop.id,
      teachingMaterial: { ...material, dialogues: updatedDialogues }
    });
  }

  function updateDialogueTitle(dialogueIndex: number, title: string) {
    if (!material) return;

    const updatedDialogues = [...material.dialogues];
    updatedDialogues[dialogueIndex] = { ...updatedDialogues[dialogueIndex], title };

    dispatch('update', {
      stopId: stop.id,
      teachingMaterial: { ...material, dialogues: updatedDialogues }
    });
  }

  function deleteDialogue(dialogueIndex: number) {
    if (!material) return;

    const updatedDialogues = material.dialogues.filter((_, i) => i !== dialogueIndex);

    dispatch('update', {
      stopId: stop.id,
      teachingMaterial: { ...material, dialogues: updatedDialogues }
    });
  }

  function addDialogueLine(dialogueIndex: number) {
    if (!material) return;

    const dialogue = material.dialogues[dialogueIndex];
    const lastSpeaker = dialogue.lines.length > 0
      ? dialogue.lines[dialogue.lines.length - 1].speaker
      : dialogue.participants[0];
    const nextSpeaker = dialogue.participants.find(p => p !== lastSpeaker) || dialogue.participants[0];

    const newLine = { speaker: nextSpeaker, text: '', translation: '' };

    const updatedDialogues = [...material.dialogues];
    updatedDialogues[dialogueIndex] = {
      ...updatedDialogues[dialogueIndex],
      lines: [...updatedDialogues[dialogueIndex].lines, newLine]
    };

    dispatch('update', {
      stopId: stop.id,
      teachingMaterial: { ...material, dialogues: updatedDialogues }
    });
  }

  function deleteDialogueLine(dialogueIndex: number, lineIndex: number) {
    if (!material) return;

    const updatedDialogues = [...material.dialogues];
    updatedDialogues[dialogueIndex] = {
      ...updatedDialogues[dialogueIndex],
      lines: updatedDialogues[dialogueIndex].lines.filter((_, i) => i !== lineIndex)
    };

    dispatch('update', {
      stopId: stop.id,
      teachingMaterial: { ...material, dialogues: updatedDialogues }
    });
  }

  function handleRegenerate() {
    dispatch('regenerate', stop.id);
  }

  function handleClose() {
    dispatch('close');
  }
</script>

<div class="teaching-material-viewer bg-white border border-slate-200 rounded-lg shadow-lg">
  <!-- Header -->
  <div class="flex items-center justify-between p-4 border-b border-slate-200">
    <div>
      <h3 class="text-lg font-semibold text-gray-900">
        {stop.location.placeName || 'Stop'} - Teaching Material
      </h3>
      {#if material}
        <p class="text-sm text-gray-500">
          {material.languageTaught} ({material.cefrLevel}) - Generated {new Date(material.generatedAt).toLocaleString()}
        </p>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        on:click={handleRegenerate}
        class="px-3 py-1.5 text-sm bg-green-100 text-green-700 border border-green-200 rounded hover:bg-green-200 transition-colors"
      >
        Regenerate
      </button>
      <button
        type="button"
        on:click={handleClose}
        class="p-1.5 text-gray-400 hover:text-gray-600"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>

  {#if !material}
    <div class="p-8 text-center text-gray-500">
      <p>No teaching material generated yet.</p>
      <button
        type="button"
        on:click={handleRegenerate}
        class="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
      >
        Generate Content
      </button>
    </div>
  {:else}
    <div class="p-4 max-h-[60vh] overflow-y-auto">
      <!-- Vocabulary Section -->
      <div class="mb-6">
        <button
          type="button"
          on:click={() => vocabularyExpanded = !vocabularyExpanded}
          class="flex items-center justify-between w-full text-left"
        >
          <h4 class="text-md font-semibold text-gray-800">
            Vocabulary ({material.vocabulary.length} items)
          </h4>
          <svg
            class="w-5 h-5 text-gray-500 transition-transform {vocabularyExpanded ? 'rotate-180' : ''}"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {#if vocabularyExpanded}
          <div class="mt-3 space-y-3">
            {#each material.vocabulary as item, index}
              <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                {#if isEditing}
                  <div class="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={item.word}
                      on:input={(e) => updateVocabularyItem(index, 'word', e.currentTarget.value)}
                      placeholder="Word"
                      class="px-2 py-1 text-sm border border-gray-200 rounded"
                    />
                    <input
                      type="text"
                      value={item.translation}
                      on:input={(e) => updateVocabularyItem(index, 'translation', e.currentTarget.value)}
                      placeholder="Translation"
                      class="px-2 py-1 text-sm border border-gray-200 rounded"
                    />
                  </div>
                  <input
                    type="text"
                    value={item.pronunciation || ''}
                    on:input={(e) => updateVocabularyItem(index, 'pronunciation', e.currentTarget.value)}
                    placeholder="Pronunciation (optional)"
                    class="w-full px-2 py-1 text-sm border border-gray-200 rounded mb-2"
                  />
                  <input
                    type="text"
                    value={item.context}
                    on:input={(e) => updateVocabularyItem(index, 'context', e.currentTarget.value)}
                    placeholder="Example sentence"
                    class="w-full px-2 py-1 text-sm border border-gray-200 rounded"
                  />
                  <button
                    type="button"
                    on:click={() => deleteVocabularyItem(index)}
                    class="mt-2 text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                {:else}
                  <div class="flex items-start justify-between">
                    <div>
                      <span class="font-medium text-green-700">{item.word}</span>
                      {#if item.pronunciation}
                        <span class="text-gray-400 text-sm ml-1">[{item.pronunciation}]</span>
                      {/if}
                      <span class="text-gray-600 mx-2">-</span>
                      <span class="text-gray-800">{item.translation}</span>
                    </div>
                  </div>
                  {#if item.context}
                    <p class="text-sm text-gray-500 mt-1 italic">"{item.context}"</p>
                  {/if}
                {/if}
              </div>
            {/each}

            {#if isEditing}
              <button
                type="button"
                on:click={addVocabularyItem}
                class="w-full py-2 text-sm text-green-600 border border-dashed border-green-300 rounded hover:bg-green-50"
              >
                + Add vocabulary item
              </button>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Dialogues Section -->
      <div>
        <button
          type="button"
          on:click={() => dialoguesExpanded = !dialoguesExpanded}
          class="flex items-center justify-between w-full text-left"
        >
          <h4 class="text-md font-semibold text-gray-800">
            Dialogues ({material.dialogues.length})
          </h4>
          <svg
            class="w-5 h-5 text-gray-500 transition-transform {dialoguesExpanded ? 'rotate-180' : ''}"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {#if dialoguesExpanded}
          <div class="mt-3 space-y-4">
            {#each material.dialogues as dialogue, dIndex}
              <div class="bg-gray-50 rounded-lg p-4 border border-gray-100">
                {#if isEditing}
                  <input
                    type="text"
                    value={dialogue.title}
                    on:input={(e) => updateDialogueTitle(dIndex, e.currentTarget.value)}
                    placeholder="Dialogue title"
                    class="w-full px-2 py-1 text-sm font-medium border border-gray-200 rounded mb-3"
                  />
                {:else}
                  <h5 class="font-medium text-gray-800 mb-3">{dialogue.title}</h5>
                {/if}

                <div class="space-y-2">
                  {#each dialogue.lines as line, lIndex}
                    <div class="pl-2 border-l-2 {line.speaker === dialogue.participants[0] ? 'border-blue-400' : 'border-green-400'}">
                      {#if isEditing}
                        <div class="flex items-center gap-2 mb-1">
                          <select
                            value={line.speaker}
                            on:change={(e) => updateDialogueLine(dIndex, lIndex, 'speaker', e.currentTarget.value)}
                            class="text-xs px-2 py-1 border border-gray-200 rounded"
                          >
                            {#each dialogue.participants as participant}
                              <option value={participant}>{participant}</option>
                            {/each}
                          </select>
                          <button
                            type="button"
                            on:click={() => deleteDialogueLine(dIndex, lIndex)}
                            class="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                        <input
                          type="text"
                          value={line.text}
                          on:input={(e) => updateDialogueLine(dIndex, lIndex, 'text', e.currentTarget.value)}
                          placeholder="Line in target language"
                          class="w-full px-2 py-1 text-sm border border-gray-200 rounded mb-1"
                        />
                        <input
                          type="text"
                          value={line.translation}
                          on:input={(e) => updateDialogueLine(dIndex, lIndex, 'translation', e.currentTarget.value)}
                          placeholder="Translation"
                          class="w-full px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded"
                        />
                      {:else}
                        <p class="text-xs text-gray-500 font-medium">{line.speaker}</p>
                        <p class="text-sm text-gray-800">{line.text}</p>
                        <p class="text-xs text-gray-500 italic">{line.translation}</p>
                      {/if}
                    </div>
                  {/each}
                </div>

                {#if isEditing}
                  <div class="mt-3 flex gap-2">
                    <button
                      type="button"
                      on:click={() => addDialogueLine(dIndex)}
                      class="text-xs text-green-600 hover:text-green-700"
                    >
                      + Add line
                    </button>
                    <button
                      type="button"
                      on:click={() => deleteDialogue(dIndex)}
                      class="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete dialogue
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Footer with edit toggle -->
    <div class="flex items-center justify-between p-4 border-t border-slate-200 bg-gray-50">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={isEditing}
          class="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
        />
        <span class="text-sm text-gray-600">Edit mode</span>
      </label>
      <button
        type="button"
        on:click={handleClose}
        class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
      >
        Close
      </button>
    </div>
  {/if}
</div>
