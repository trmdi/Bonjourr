declare namespace WallpaperProvider {
	type Local = {
		[key in WallpaperProvider.Sync['lastCollec']]: WallpaperProvider.Image[]
	}

	type CollectionTypes = 'night' | 'noon' | 'day' | 'evening' | 'user'

	interface Sync {
		time?: number
		every: Frequency
		collection: string
		pausedImage?: WallpaperProvider.Image
		lastCollec: WallpaperProvider.CollectionTypes
	}

	interface Image {
		url: string
		link: string
		download_link: string
		username: string
		name: string
		city: string | null
		country: string | null
		color: string
		exif?: {
			make: string
			model: string
			exposure_time: string
			aperture: string
			focal_length: string
			iso: number
		}
	}

	interface API {
		color: string
		blur_hash: string
		description: string
		exif: {
			make: string
			model: string
			exposure_time: string
			aperture: string
			focal_length: string
			iso: number
		}
		location: {
			name: string
			city: string
			country: string
		}
		urls: {
			raw: string
		}
		links: {
			html: string
			download: string
		}
		user: {
			username: string
			name: string
			links: {
				html: string
			}
		}
	}
}
