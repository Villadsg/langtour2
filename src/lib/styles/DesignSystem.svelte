<!--
  DesignSystem.svelte - Central location for design tokens and styling
  This component doesn't render anything but exports CSS variables and utility classes
-->
<script context="module">
  // Color palette - Nature-inspired green theme with orange accents
  export const colors = {
    primary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
    accent: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    }
  };

  // Gradient backgrounds
  export const gradients = {
    hero: 'bg-gradient-to-b from-slate-50 to-white',
    card: 'bg-white',
    accent: 'bg-gradient-to-r from-slate-50 to-slate-100',
    subtle: 'bg-slate-50'
  };

  // Typography
  export const typography = {
    heading: {
      h1: 'text-4xl md:text-5xl font-semibold leading-tight',
      h2: 'text-2xl font-medium',
      h3: 'text-xl font-medium',
      h4: 'text-lg font-medium'
    },
    body: {
      large: 'text-xl',
      normal: 'text-base',
      small: 'text-sm',
      tiny: 'text-xs'
    }
  };

  export const text = {
    primary: 'text-slate-800',
    secondary: 'text-slate-600',
    muted: 'text-slate-400',
    inverse: 'text-white'
  };

  export const navbar = {
    bg: 'bg-white border-b border-slate-200 shadow-sm',
    link: 'text-slate-400 hover:text-slate-700 transition-colors',
    activeLink: 'text-slate-800 border-b-2 border-slate-800',
    mobileBg: 'bg-white border-t border-slate-200'
  };

  // Spacing
  export const spacing = {
    section: 'py-12',
    container: 'px-6',
    gap: {
      small: 'gap-2',
      medium: 'gap-4',
      large: 'gap-8'
    }
  };

  // Components
  export const components = {
    card: {
      base: 'border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 bg-white',
      highlight: 'border border-slate-300 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 bg-white'
    },
    button: {
      primary: 'bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 px-5 shadow-sm hover:shadow-md transition-all duration-150 ease-in-out rounded-lg disabled:opacity-60 disabled:cursor-not-allowed',
      secondary: 'bg-white text-slate-600 border border-slate-200 font-medium py-2.5 px-5 transition-colors duration-150 ease-in-out hover:bg-slate-50 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed',
      accent: 'bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-2.5 px-5 transition-all duration-150 ease-in-out rounded-lg disabled:opacity-60 disabled:cursor-not-allowed',
      outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium py-2.5 px-5 transition-colors duration-150 ease-in-out rounded-lg disabled:opacity-60 disabled:cursor-not-allowed',
      ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-5 transition-colors duration-150 ease-in-out rounded-lg border border-slate-200 disabled:opacity-60 disabled:cursor-not-allowed'
    },
    tag: {
      primary: 'inline-block px-2.5 py-1 bg-slate-50 text-slate-700 text-sm border border-slate-200 rounded-md',
      accent: 'inline-block px-2.5 py-1 bg-amber-50 text-amber-700 text-sm border border-amber-200 rounded-md',
      secondary: 'inline-block px-2.5 py-1 bg-slate-50 text-slate-500 text-sm border border-slate-200 rounded-md'
    },
    input: {
      base: 'block w-full p-3 text-slate-700 border border-slate-200 bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400 transition-colors duration-150 ease-in-out rounded-lg'
    },
    section: {
      light: 'bg-white',
      dark: 'bg-slate-800 text-white',
      accent: 'bg-slate-100 text-slate-700',
      muted: 'bg-slate-50'
    }
  };

  // Animations
  export const animations = {
    fadeIn: 'transition-opacity duration-300 ease-in-out',
    hover: 'transition-all duration-300 ease-in-out'
  };
</script>

<!-- This component doesn't render anything -->
