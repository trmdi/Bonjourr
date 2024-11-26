import unsplash from './providers/unsplash'
import wallhaven from './providers/wallhaven'

import { periodOfDay, turnRefreshButton, apiFetch, freqControl, isEvery } from '../../utils'
import { BACKGROUND_LOCAL_DEFAULT, BACKGROUND_SYNC_DEFAULT } from '../../defaults'
import { imgBackground } from '.'
import { tradThis } from '../../utils/translations'
import errorMessage from '../../utils/errormessage'
import networkForm from '../../utils/networkform'
import { settingsBackgroundForm } from '../../settings'
import storage from '../../storage'

type ProviderInit = {
    name: string
	sync: WallpaperProvider.Sync
	cache: WallpaperProvider.Local
}

type ProviderUpdate = {
	refresh?: HTMLElement
	collection?: string
	every?: string
}

// TODO: dynamically load module?
let providers = {
    unsplash: unsplash,
    wallhaven: wallhaven,
}
let currentProvider

const collectionForm = networkForm('f_collection')

export const bonjourrCollection = (lastCollec: string) => { return currentProvider.collection[lastCollec] }

export default async function providerBackgrounds(init?: ProviderInit, event?: ProviderUpdate) {
	if (event) {
		updateProvider(event)
            .then((msg) => console.log('event update', msg))
	}

	if (init) {
        currentProvider = providers[init.name]

        try {
			if (init.sync?.time === undefined) {
				initProviderBackgrounds()
                    .then(settingsBackgroundForm)
			} else {
				cacheControl(init.sync, init.cache)
                    .then(settingsBackgroundForm)
			}
		} catch (e) {
			errorMessage(e)
		}
	}
}

async function updateProvider({ refresh, every, collection }: ProviderUpdate) {
	const sync = await getProviderSync()
	const cache = await getProviderCache()

	if (!sync) {
		return
	}

	if (refresh) {
		if (sessionStorage.waitingForPreload) {
			turnRefreshButton(refresh, false)
			return
		}

		sync.time = 0
		storage.sync.set({ [currentProvider.name]: sync })
		turnRefreshButton(refresh, true)

		setTimeout(() => cacheControl(sync, cache), 400)
	}

	if (isEvery(every)) {
		const currentImage = cache[sync.lastCollec][0]
		sync.pausedImage = every === 'pause' ? currentImage : undefined
		sync.every = every
		sync.time = freqControl.set()
		storage.sync.set({ [currentProvider.name]: sync })
	}

	if (collection === '') {
		cache.user = []
		sync.collection = ''
		sync.lastCollec = periodOfDay()

		providerBackgrounds({ name: currentProvider.name, sync: sync, cache: cache })
		collectionForm.accept('i_collection', currentProvider.collection[sync.lastCollec])
	}

	if (collection !== undefined && collection.length > 0) {
		if (!navigator.onLine) {
			return collectionForm.warn(tradThis('No internet connection'))
		}

        collection = currentProvider.parseInput(collection)
		// add new collec
        sync.collection = collection
		sync.lastCollec = 'user'
		sync.time = freqControl.set()

		collectionForm.load()

		const list = await requestNewList(collection)

		if (!list || list.length === 0) {
			collectionForm.warn(`Cannot get "${collection}"`)
			return
		}

		cache['user'] = list

		await preloadImage(cache['user'][0].url)
		preloadImage(cache['user'][1].url)
		loadBackground(cache['user'][0])

		collectionForm.accept('i_collection', collection)
	}

	storage.sync.set({ [currentProvider.name]: sync})
	storage.local.set({ [`${currentProvider.name}Cache`]: cache})

    return {name: currentProvider.name, ...sync}
}

async function cacheControl(sync: WallpaperProvider.Sync, cache?: WallpaperProvider.Local) {
	sync = sync ?? (await getProviderSync())
	cache = cache ?? (await getProviderCache())

	let { lastCollec } = sync
	const { every, time, collection, pausedImage } = sync

	const needNewImage = freqControl.get(every, time ?? Date.now())
	const needNewCollec = !every.match(/day|pause/) && periodOfDay() !== lastCollec

	if (needNewCollec && lastCollec !== 'user') {
		lastCollec = periodOfDay()
	}

	let collectionId = lastCollec === 'user' ? collection : currentProvider.collection[lastCollec]
	let list = cache[lastCollec]

	if (list.length === 0) {
		const newlist = await requestNewList(collectionId)

		if (!newlist) {
			return
		}

		list = newlist
		await preloadImage(list[0].url)

		cache[lastCollec] = list
		storage.local.set({ [`${currentProvider.name}Cache`]: cache })
		sessionStorage.setItem('waitingForPreload', 'true')
	}

	if (sessionStorage.waitingForPreload === 'true') {
		loadBackground(list[0])
		preloadImage(list[1].url)
		return {name: currentProvider.name, ...sync}
	}

	if (!needNewImage) {
		const hasPausedImage = every === 'pause' && pausedImage
		loadBackground(hasPausedImage ? pausedImage : list[0])
		return {name: currentProvider.name, ...sync}
	}

	// Needs new image, Update time
	sync.lastCollec = lastCollec
	sync.time = freqControl.set()

	if (list.length > 1) {
		list.shift()
	}

	loadBackground(list[0])

	if (every === 'pause') {
		sync.pausedImage = list[0]
	}

	// If end of cache, get & save new list
	if (list.length === 1 && navigator.onLine) {
		const newList = await requestNewList(collectionId)

		if (newList) {
			cache[sync.lastCollec] = list.concat(newList)
			preloadImage(newList[0].url)
		}
	}

	// Or preload next
	else if (list.length > 1) {
		preloadImage(list[1].url)
	}

	storage.sync.set({ [currentProvider.name]: sync })
	storage.local.set({ [`${currentProvider.name}Cache`]: cache })

    return {name: currentProvider.name, ...sync}
}

async function initProviderBackgrounds() {
	const sync = await getProviderSync()
	const cache = await getProviderCache()

	const lastCollec = periodOfDay()
	let list = await requestNewList(currentProvider.collection[lastCollec])

	if (!list) {
		return
	}

	cache[lastCollec] = list
	sync.lastCollec = lastCollec
	sync.time = new Date().getTime()
    sync.every = 'hour'
	preloadImage(list[0].url)

	// With weather loaded and different suntime
	// maybe use another collection ?

	await new Promise((sleep) => setTimeout(sleep, 200))

	const lastCollecAgain = periodOfDay()

	if (lastCollec !== lastCollecAgain) {
		list = (await requestNewList(currentProvider.collection[lastCollecAgain])) ?? []
		sync.lastCollec = lastCollecAgain
		cache[lastCollecAgain] = list
	}

	storage.sync.set({ [currentProvider.name]: sync})
	storage.local.set({ [`${currentProvider.name}Cache`]: cache })
	sessionStorage.setItem('waitingForPreload', 'true')

	loadBackground(list[0])
	preloadImage(list[1].url)

    return {name: currentProvider.name, ...sync}
}

async function requestNewList(collection: string): Promise<Provider.Image[] | null> {
	let json: Provider.API[]

	const resp = await apiFetch(currentProvider.getApiUrl(collection))

	if (resp?.status === 404) {
		return null
	}

	json = await resp?.json()

	if (json.length === 1) {
		return null
	}

	return currentProvider.filterList(json)
}

function imgCredits(image: Provider.Image) {
	const domcontainer = document.getElementById('credit-container')
	const domcredit = document.getElementById('credit')

	if (!domcontainer || !domcredit) return

	domcredit.textContent = ''
    const credits = currentProvider.getCredits(image)
    for (const credit of credits) {
        domcredit.appendChild(credit)
    }

	// cached data may not contain download link
	if (image.download_link) {
		appendSaveLink(domcredit, image)
	}

	domcontainer.classList.toggle('shown', true)
}

async function getProviderSync(): Promise<WallpaperProvider.Sync> {
	const sync = (await storage.sync.get())?.[currentProvider.name] ?? { ...BACKGROUND_SYNC_DEFAULT}
	return sync
}

async function getProviderCache(): Promise<WallpaperProvider.Local> {
	const cache = (await storage.local.get())?.[`${currentProvider.name}Cache`] ?? { ...BACKGROUND_LOCAL_DEFAULT}
	return cache
}

function loadBackground(props: Provider.Image) {
	imgBackground(props.url, props.color)
	imgCredits(props)
}

async function preloadImage(src: string) {
	const img = new Image()

	sessionStorage.setItem('waitingForPreload', 'true')

	try {
        img.referrerPolicy = 'no-referrer'
		img.src = src
		await img.decode()
		img.remove()
		sessionStorage.removeItem('waitingForPreload')
	} catch (_) {
		console.warn('Could not decode image: ', src)
	}
}

function appendSaveLink(domcredit: HTMLElement, image: Provider.Image) {
	const domsave = document.createElement('a')
	domsave.className = 'save'
	domsave.title = 'Download the current background to your computer'
	domsave.onclick = () => saveImage(domsave, image)

	domcredit.appendChild(domsave)
}

async function saveImage(domsave: HTMLAnchorElement, image: Provider.Image) {
	domsave.classList.add('loading')
	try {
        const apiDownloadUrl = currentProvider.getDownloadUrl(image)
		const downloadResponse = await apiFetch(apiDownloadUrl)

		if (!downloadResponse) return

		const data: { url: string } = await downloadResponse.json()
		const imageResponse = await apiFetch(data.url)

		if (!imageResponse.ok) return

		const blob = await imageResponse.blob()

		domsave.onclick = null
		domsave.href = URL.createObjectURL(blob)
		domsave.download = downloadUrl.pathname.split('/')[2]

		domsave.click()
	} finally {
		domsave.classList.remove('loading')
	}
}
