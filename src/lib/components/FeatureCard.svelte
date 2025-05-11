<script lang="ts">
  import { components, text } from '$lib/styles/DesignSystem.svelte';
  
  export let icon: string;
  export let title: string;
  export let description: string;
</script>

<div class="bg-white/10 backdrop-blur-sm p-6 rounded-sm border border-white/20">
  <div class="flex items-center mb-4">
    <div class="text-indigo-300 mr-3">
      {@html icon}
    </div>
    <h3 class="text-lg font-medium">{title}</h3>
  </div>
  <p class={`text-sm ${text.secondary}`}>{description}</p>
</div>
