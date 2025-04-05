<script lang="ts">
    import type { City } from '$lib/stores/tourStore';
    
    let { city } = $props<{ city: City }>();
</script>

<a href="/cities/{city.id}" class="block rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
    <div class="relative h-48">
        <img 
            src={city.imageUrl || '/images/placeholder.svg'} 
            alt="{city.name}" 
            class="w-full h-full object-cover"
        />
    </div>
    <div class="p-4 bg-white">
        <h3 class="text-xl font-semibold">{city.name}</h3>
        <p class="text-gray-600">{city.country}</p>
    </div>
</a>
