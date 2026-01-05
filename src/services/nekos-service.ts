const NEKOS_API_BASE = 'https://api.nekosapi.com/v4';

/**
 * Get a random anime GIF/image from Nekos API
 * @param tags - Tags/categories for the GIF (comma-separated string or array, e.g., 'happy', 'excited', 'celebrate', 'dance', 'smile', 'sad', 'cry')
 * @param rating - Rating filter: 'safe', 'suggestive', 'borderline', 'explicit' (default: 'safe')
 * @returns URL of the GIF/image or null if error
 */
export async function getNekosGif(
  tags: string | string[] = 'happy', 
  rating: 'safe' | 'suggestive' | 'borderline' | 'explicit' = 'safe'
): Promise<string | null> {
  try {
    // Convert tags to array format if needed
    const tagsArray = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    const tagsParam = tagsArray.join(',');
    
    // Nekos API v4 endpoint for random images
    // Format: /images/random?limit=1&tags=tag1,tag2&rating=safe
    const url = `${NEKOS_API_BASE}/images/random?limit=1&tags=${encodeURIComponent(tagsParam)}&rating=${rating}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Nekos] API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as { 
      items?: Array<{ 
        image_url?: string; 
        url?: string;
        file_url?: string;
        attributes?: {
          image_url?: string;
          file_url?: string;
        };
      }> 
    };
    
    // Try to get image URL from response
    if (data.items && data.items.length > 0) {
      const image = data.items[0];
      return image.image_url || image.url || image.file_url || image.attributes?.image_url || image.attributes?.file_url || null;
    }

    return null;
  } catch (error) {
    console.error('[Nekos] Error fetching GIF:', error);
    return null;
  }
}

/**
 * Get a random anime GIF for celebrations (level up, achievements, etc.)
 */
export async function getCelebrationGif(): Promise<string | null> {
  const categories = ['happy', 'excited', 'celebrate', 'dance', 'smile'];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  return getNekosGif(randomCategory);
}

/**
 * Get a random anime GIF for errors/failures
 */
export async function getErrorGif(): Promise<string | null> {
  return getNekosGif('sad');
}

/**
 * Get a random anime GIF for success
 */
export async function getSuccessGif(): Promise<string | null> {
  return getNekosGif('happy');
}
