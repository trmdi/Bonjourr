import { tradThis } from '../../../utils/translations'

const currentProvider = {name: 'unsplash'}
export default currentProvider

// https://unsplash.com/@bonjourr/collections
currentProvider.collection = {
	noon: 'GD4aOSg4yQE',
	day: 'o8uX55RbBPs',
	evening: '3M2rKTckZaQ',
	night: 'bHDh4Ae7O8o',
}
currentProvider.parseInput = (input: string) => {
    const isFullURL = input.includes('https://unsplash.com/') && input.includes('/collections/')
    if (isFullURL) {
        const start = input.indexOf('/collections/') + 13
        const end = input.indexOf('/', start)
        input = input.slice(start, end)
    }
    return input
}
currentProvider.getApiUrl = (collection: string) => {
    return `/unsplash/photos/random?collections=${collection}&count=8`
}
currentProvider.filterList = (json: {}) => {
    const filteredList: Provider.Image[] = [] 
    let { width, height } = screen

    // Swap values if wrong orientation
    if (
        (screen.orientation.type === 'landscape-primary' && height > width) ||
        (screen.orientation.type === 'portrait-primary' && width > height)
    ) {
        ;[width, height] = [height, width]
    }

    const dpr = window.devicePixelRatio

    // Increase compression with pixel density
    // https://docs.imgix.com/tutorials/responsive-images-srcset-imgix#use-variable-quality
    const quality = Math.min(100 - dpr * 20, 75)

    const isExifEmpty = (exif: Provider.API['exif']) => Object.values(exif).every((val) => !val)

    for (const img of json) {
        filteredList.push({
            url: `${img.urls.raw}&w=${width}&h=${height}&dpr=${dpr}&auto=format&q=${quality}&fit=crop`,
            link: img.links.html,
            download_link: img.links.download,
            username: img.user.username,
            name: img.user.name,
            city: img.location.city,
            country: img.location.country,
            color: img.color,
            exif: isExifEmpty(img.exif) ? undefined : img.exif,
        })
    }
    return filteredList
}
currentProvider.getDownloadUrl = (image) => {
    const downloadUrl = new URL(image.download_link)
    return '/unsplash' + downloadUrl.pathname + downloadUrl.search
}
currentProvider.getCredits = (image) => {
    const hasLocation = image.city || image.country
    let exif = ''
    let credits = ''

    if (image.exif) {
        const { iso, model, aperture, exposure_time, focal_length } = image.exif

        // ⚠️ In this order !
        if (model) exif += `${model} - `
        if (aperture) exif += `f/${aperture} `
        if (exposure_time) exif += `${aperture}s `
        if (iso) exif += `${iso}ISO `
        if (focal_length) exif += `${focal_length}mm`
    }

    if (hasLocation) {
        const city = image.city || ''
        const country = image.country || ''
        const comma = city && country ? ', ' : ''
        credits = `${city}${comma}${country} <name>`
    } else {
        credits = tradThis('Photo by <name>')
    }

    const [location, rest] = credits.split(' <name>')
    const domlocation = document.createElement('a')
    const domspacer = document.createElement('span')
    const domrest = document.createElement('span')
    const domartist = document.createElement('a')
    const domexif = document.createElement('p')

    domexif.className = 'exif'
    domexif.textContent = exif
    domlocation.textContent = location
    domartist.textContent = image.name.slice(0, 1).toUpperCase() + image.name.slice(1)
    domspacer.textContent = hasLocation ? ' - ' : ' '
    domrest.textContent = rest

    domlocation.href = `${image.link}?utm_source=Bonjourr&utm_medium=referral`
    domartist.href = `https://unsplash.com/@${image.username}?utm_source=Bonjourr&utm_medium=referral`

    return [domexif, domlocation, domspacer, domartist, domrest]
}
