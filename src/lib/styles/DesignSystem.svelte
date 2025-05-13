<!-- 
  DesignSystem.svelte - Central location for design tokens and styling
  This component doesn't render anything but exports CSS variables and utility classes
-->
<script context="module">
  // Color palette - Nature-inspired green theme for language learning tours
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

  // Gradient backgrounds - Nature-inspired
  export const gradients = {
    hero: 'bg-gradient-to-r from-gray-50 via-green-50 to-gray-50',
    card: 'bg-gradient-to-br from-white to-green-50',
    accent: 'bg-gradient-to-r from-green-500 to-emerald-500',
    subtle: 'bg-gradient-to-r from-green-50 to-white'
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
    bg: 'bg-white border-b border-gray-200 shadow-sm',
    link: 'text-slate-700 hover:text-green-600',
    activeLink: 'border-b-2 border-green-500',
    mobileBg: 'bg-white border-t border-gray-200'
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
      base: 'border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 bg-white',
      highlight: 'border border-green-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 bg-white'
    },
    button: {
      primary: 'bg-green-500 hover:bg-green-600 text-white font-normal py-2.5 px-5 transition-colors duration-150 ease-in-out rounded-lg shadow-sm',
      secondary: 'bg-gray-100 text-slate-700 border border-gray-300 font-normal py-2.5 px-5 transition-colors duration-150 ease-in-out hover:bg-gray-50 rounded-lg shadow-sm',
      outline: 'border border-green-500 text-green-600 hover:bg-green-50 font-normal py-2.5 px-5 transition-colors duration-150 ease-in-out rounded-lg shadow-sm'
    },
    tag: {
      primary: 'inline-block px-2.5 py-1 bg-green-100 text-green-700 text-sm border border-green-200 rounded-md',
      secondary: 'inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-sm border border-gray-200 rounded-md'
    },
    input: {
      base: 'block w-full p-3 text-slate-700 border border-gray-300 bg-white focus:ring-green-500 focus:border-green-500 transition-colors duration-150 ease-in-out rounded-md'
    },
    section: {
      light: 'bg-white',
      dark: 'bg-slate-900 text-white',
      accent: 'bg-green-600 text-white',
      muted: 'bg-green-50'
    }
  };

  // Animations
  export const animations = {
    fadeIn: 'transition-opacity duration-300 ease-in-out',
    hover: 'transition-all duration-300 ease-in-out'
  };
</script>

<!-- This component doesn't render anything -->
