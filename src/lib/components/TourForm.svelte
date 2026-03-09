<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { ConvexService } from '$lib/firebaseService';
    
    export let tour = {
        name: '',
        cityId: '',
        language: '',
        description: '',
        imageUrl: ''
    };
    export let isEditing = false;
    
    const dispatch = createEventDispatcher();
    
    // File upload state
    let selectedFile: File | null = null;
    let filePreview: string | null = null;
    let isUploading = false;
    let uploadError = '';
    let currentImageUrl = tour.imageUrl;
    
    // City options
    const cities = [
        { id: 'copenhagen', name: 'Copenhagen', country: 'Denmark' },
        { id: 'madrid', name: 'Madrid', country: 'Spain' }
    ];
    
    // Language options
    const languages = ['Danish', 'Spanish', 'English', 'French', 'German', 'Italian'];
    
    onMount(() => {
        // Set the current image URL for preview if editing
        if (isEditing && tour.imageUrl) {
            currentImageUrl = tour.imageUrl;
        }
    });
    
    // Function to compress an image to a maximum size (in bytes)
    const compressImage = async (file: File, maxSizeBytes: number = 2 * 1024 * 1024): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // Calculate the ratio to maintain aspect ratio while reducing size
                    let ratio = 1;
                    
                    // Start with a reasonable quality
                    let quality = 0.7;
                    
                    // If the image is very large, reduce dimensions first
                    if (width > 1920 || height > 1080) {
                        ratio = Math.min(1920 / width, 1080 / height);
                        width *= ratio;
                        height *= ratio;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    
                    // Try to compress with the initial quality
                    const compressAndCheck = (q: number) => {
                        const dataUrl = canvas.toDataURL('image/jpeg', q);
                        const bytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);
                        
                        if (bytes > maxSizeBytes && q > 0.1) {
                            // If still too large, try with lower quality
                            return compressAndCheck(q - 0.1);
                        } else {
                            // Convert base64 to blob
                            const byteString = atob(dataUrl.split(',')[1]);
                            const mimeType = dataUrl.split(',')[0].split(':')[1].split(';')[0];
                            const ab = new ArrayBuffer(byteString.length);
                            const ia = new Uint8Array(ab);
                            
                            for (let i = 0; i < byteString.length; i++) {
                                ia[i] = byteString.charCodeAt(i);
                            }
                            
                            const blob = new Blob([ab], { type: mimeType });
                            const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
                            
                            console.log(`Compressed image from ${file.size} to ${compressedFile.size} bytes (${Math.round(compressedFile.size / 1024)}KB)`);
                            resolve(compressedFile);
                        }
                    };
                    
                    compressAndCheck(quality);
                };
                img.onerror = () => reject(new Error('Failed to load image'));
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
        });
    };

    const handleFileChange = async (event: Event) => {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];
            uploadError = '';
            
            try {
                // Check if file is an image
                if (!file.type.startsWith('image/')) {
                    uploadError = 'Please select an image file';
                    return;
                }
                
                // Create a preview of the selected image
                const reader = new FileReader();
                reader.onload = (e) => {
                    filePreview = e.target?.result as string;
                };
                reader.readAsDataURL(file);
                
                // Compress the image if it's larger than 2MB
                if (file.size > 2 * 1024 * 1024) {
                    selectedFile = await compressImage(file);
                } else {
                    selectedFile = file;
                }
            } catch (error) {
                console.error('Error processing image:', error);
                uploadError = 'Error processing image. Please try another file.';
            }
        }
    };
    
    const handleSubmit = async () => {
        // Validate form - only required fields are name, cityId, language, and description
        if (!tour.name || !tour.cityId || !tour.language || !tour.description) {
            alert('Please fill in all required fields');
            return;
        }
        
        // If a file is selected, upload it first
        if (selectedFile) {
            isUploading = true;
            uploadError = '';
            
            try {
                // Get current user if available for permissions
                let userId = undefined;
                try {
                    const user = await ConvexService.getAccount();
                    if (user) {
                        userId = user.id;
                    }
                } catch (err) {
                    // Continue without user ID
                }
                
                // Upload the file to Supabase storage
                const uploadResult = await ConvexService.uploadFile(selectedFile, userId);
                
                // Set the image URL to the uploaded file URL
                const fileId = uploadResult.id;
                const imageUrl = uploadResult.url;
                tour.imageUrl = imageUrl;
                
                isUploading = false;
                
                // Dispatch the submit event with the updated tour data
                dispatch('submit', tour);
            } catch (err: any) {
                isUploading = false;
                uploadError = err.message || 'Failed to upload image';
                console.error('Error uploading file:', err);
            }
        } else {
            // If no new file is selected and we're creating a new tour (not editing),
            // we can proceed without an image
            if (!isEditing) {
                // For new tours without an image, set imageUrl to empty or a placeholder
                tour.imageUrl = '';
            }
            // Otherwise keep the existing imageUrl for edited tours
            
            // Proceed with form submission
            dispatch('submit', tour);
        }
    };
    
    const handleCancel = () => {
        dispatch('cancel');
    };
</script>

<form on:submit|preventDefault={handleSubmit} class="bg-white border border-slate-200 rounded-lg p-6">
    <div class="mb-4">
        <label for="name" class="block text-slate-700 text-sm font-medium mb-2">
            Trail Name *
        </label>
        <input
            type="text"
            id="name"
            bind:value={tour.name}
            class="appearance-none border border-slate-200 rounded-lg w-full py-2.5 px-3 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-colors"
            required
        />
    </div>

    <div class="mb-4">
        <label for="cityId" class="block text-slate-700 text-sm font-medium mb-2">
            City *
        </label>
        <select
            id="cityId"
            bind:value={tour.cityId}
            class="appearance-none border border-slate-200 rounded-lg w-full py-2.5 px-3 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-colors"
            required
        >
            <option value="" disabled>Select a city</option>
            {#each cities as city}
                <option value={city.id}>{city.name}, {city.country}</option>
            {/each}
        </select>
    </div>

    <div class="mb-4">
        <label for="language" class="block text-slate-700 text-sm font-medium mb-2">
            Language *
        </label>
        <select
            id="language"
            bind:value={tour.language}
            class="appearance-none border border-slate-200 rounded-lg w-full py-2.5 px-3 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-colors"
            required
        >
            <option value="" disabled>Select a language</option>
            {#each languages as language}
                <option value={language}>{language}</option>
            {/each}
        </select>
    </div>

    <div class="mb-4">
        <label for="description" class="block text-slate-700 text-sm font-medium mb-2">
            Description *
        </label>
        <textarea
            id="description"
            bind:value={tour.description}
            class="appearance-none border border-slate-200 rounded-lg w-full py-2.5 px-3 text-slate-700 leading-tight focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-colors h-32"
            required
        ></textarea>
    </div>
    
    <div class="mb-6">
        <span id="tourImageLabel" class="block text-slate-700 text-sm font-medium mb-2">
            Trail Image <span class="text-slate-400 font-normal">(optional)</span>
        </span>
        
        <!-- Current image preview (if editing) -->
        {#if currentImageUrl && !filePreview}
            <div class="mb-3">
                <p class="text-sm text-slate-600 mb-2">Current image:</p>
                <div class="relative w-full h-48 bg-slate-100 rounded-lg overflow-hidden">
                    <img src={currentImageUrl} alt="Trail view" class="w-full h-full object-cover" />
                </div>
            </div>
        {/if}

        <!-- File upload input -->
        <div class="mb-3">
            <label for="tourImage" class="block text-sm text-slate-600 mb-2">
                {isEditing ? 'Change image:' : 'Upload image:'}
            </label>
            <input
                type="file"
                id="tourImage"
                accept="image/*"
                on:change={handleFileChange}
                aria-labelledby="tourImageLabel"
                class="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-medium
                    file:bg-green-50 file:text-green-700
                    hover:file:bg-green-100"
            />
        </div>
        
        <!-- New file preview -->
        {#if filePreview}
            <div class="mb-3">
                <p class="text-sm text-slate-600 mb-2">New image preview:</p>
                <div class="relative w-full h-48 bg-slate-100 rounded-lg overflow-hidden">
                    <img src={filePreview} alt="Trail preview" class="w-full h-full object-cover" />
                </div>
            </div>
        {/if}
        
        <!-- Upload error message -->
        {#if uploadError}
            <div class="text-red-500 text-sm mt-2" role="alert">
                {uploadError}
            </div>
        {/if}
    </div>
    
    <div class="flex items-center justify-between">
        <button
            type="submit"
            class="bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 font-medium py-2.5 px-5 rounded-lg transition-colors flex items-center"
            disabled={isUploading}
        >
            {#if isUploading}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
            {:else}
                {isEditing ? 'Update Trail' : 'Create Trail'}
            {/if}
        </button>
        <button
            type="button"
            on:click={handleCancel}
            class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-5 rounded-lg border border-slate-200 transition-colors"
            disabled={isUploading}
        >
            Cancel
        </button>
    </div>
</form>
