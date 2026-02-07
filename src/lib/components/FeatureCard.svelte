<script lang="ts">
  import { components, text } from '$lib/styles/DesignSystem.svelte';
  
  export let icon: string;
  export let title: string;
  export let description: string;
</script>

<div class="bg-white p-6 rounded-lg border border-slate-200 hover:shadow-sm transition-shadow duration-200">
  <div class="flex items-center mb-3">
    <div class="text-green-500 mr-3">
      {@html icon}
    </div>
    <h3 class="text-lg font-medium text-slate-800">{title}</h3>
  </div>
  <p class={`text-sm ${text.secondary}`}>{description}</p>
</div>
