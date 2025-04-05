<script lang="ts">
    import type { Tour } from '$lib/stores/tourStore';
    
    let { tour } = $props<{ tour: Tour }>();
</script>

<a href="/tours/{tour.id}" class="block rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 bg-white mb-4">
    <div class="p-5">
        <h3 class="text-xl font-semibold">{tour.name}</h3>
        <div class="mt-1 inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            {tour.language}
        </div>
        <p class="mt-3 text-gray-700">{tour.description}</p>
    </div>
</a>
