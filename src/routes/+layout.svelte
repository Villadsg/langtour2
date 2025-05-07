<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="min-h-screen flex flex-col">
	
	<main class="flex-grow">
		{@render children()}
	</main>

	<footer class="bg-gray-800 text-white py-6">
		<div class="container mx-auto px-4">
			<div class="flex flex-col md:flex-row justify-between items-center">
				<div class="mb-4 md:mb-0">
					<p>&copy; 2025 LangTour. All rights reserved.</p>
				</div>
				<div class="flex space-x-4">
					<a href="/about" class="text-gray-300 hover:text-white">About</a>
					<a href="/contact" class="text-gray-300 hover:text-white">Contact</a>
					<a href="/privacy" class="text-gray-300 hover:text-white">Privacy</a>
				</div>
			</div>
		</div>
	</footer>
</div>
