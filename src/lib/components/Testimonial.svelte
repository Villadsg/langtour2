<script lang="ts">
  import { components, gradients } from '$lib/styles/DesignSystem.svelte';
  
  export let quote: string;
  export let author: string;
  export let role: string;
  export let avatar: string = '';
</script>

<div class="p-6 border border-slate-200 shadow-sm bg-white">
  <div class="flex flex-col h-full">
    <div class="mb-4 text-indigo-600">
      <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
      </svg>
    </div>
    <p class="text-slate-700 mb-4 flex-grow">{quote}</p>
    <div class="flex items-center mt-auto">
      {#if avatar}
        <img src={avatar} alt={author} class="h-10 w-10 rounded-full mr-3" />
      {:else}
        <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
          <span class="text-indigo-700 font-medium text-sm">{author.charAt(0)}</span>
        </div>
      {/if}
      <div>
        <div class="font-medium text-slate-800">{author}</div>
        <div class="text-sm text-slate-500">{role}</div>
      </div>
    </div>
  </div>
</div>
