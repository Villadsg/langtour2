<script lang="ts">
  import { gradients, components, typography } from '$lib/styles/DesignSystem.svelte';
  
  export let title: string;
  export let subtitle: string;
  export let primaryButtonText: string = '';
  export let primaryButtonLink: string = '';
  export let secondaryButtonText: string = '';
  export let secondaryButtonLink: string = '';
</script>

<div class={`${gradients.hero} text-white py-16`}>
  <div class="container mx-auto px-6">
    <div class="max-w-4xl mx-auto text-center">
      <h2 class={`${typography.heading.h1} mb-4`}>{title}</h2>
      <p class="text-xl text-slate-200 mb-8">{subtitle}</p>
      
      {#if primaryButtonText || secondaryButtonText}
        <div class="mt-8">
          {#if primaryButtonText}
            <a href={primaryButtonLink} class={`${components.button.primary} inline-block mx-2`}>
              {primaryButtonText}
            </a>
          {/if}
          
          {#if secondaryButtonText}
            <a href={secondaryButtonLink} class={`${components.button.secondary} inline-block mx-2`}>
              {secondaryButtonText}
            </a>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
