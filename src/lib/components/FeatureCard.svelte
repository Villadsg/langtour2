<script lang="ts">
  import { components, text } from '$lib/styles/DesignSystem.svelte';
  
  export let icon: string;
  export let title: string;
  export let description: string;
</script>

<div class="bg-white p-6 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
  <div class="flex items-center mb-3">
    <div class="bg-slate-100 text-slate-500 rounded-full p-2.5 mr-3">
      {@html icon}
    </div>
    <h3 class="text-base font-semibold text-slate-800">{title}</h3>
  </div>
  <p class={`text-sm ${text.secondary}`}>{description}</p>
</div>
