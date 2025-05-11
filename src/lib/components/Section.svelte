<script lang="ts">
  import { components, spacing } from '$lib/styles/DesignSystem.svelte';
  
  export let variant: 'light' | 'dark' | 'accent' | 'muted' = 'light';
  export let container = true;
  export let fullWidth = false;
  export let paddingY = true;
</script>

<section class={`${paddingY ? spacing.section : ''} ${components.section[variant]}`}>
  {#if container}
    <div class={`${fullWidth ? 'w-full' : 'container mx-auto'} ${spacing.container}`}>
      <slot />
    </div>
  {:else}
    <slot />
  {/if}
</section>
