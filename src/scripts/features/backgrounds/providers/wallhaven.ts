import { tradThis } from '../../../utils/translations'

const currentProvider = {name: 'wallhaven'}
export default currentProvider

const search_settings = 'categories=110&purity=100&sorting=random&order=desc&ai_art_filter=1'

currentProvider.collection = {
	noon: 'sunrise',
	day: 'sunlight',
	evening: 'sunset',
	night: 'night',
}
currentProvider.parseInput = (input: string) => {
    return input 
}
currentProvider.getApiUrl = (input: string) => {
    input = input.replace(/^.*wallhaven\.cc\/.*search\?/g, '')
    const isParam = (/^(\w+=[^&]*&?)+$/).test(input)
    const url = 'https://wallhaven.cc/api/v1/search?' +
        (isParam ? input : `${search_settings}&q=${input}`)
    return `http://192.168.1.46:9090/${url}`
}
currentProvider.filterList = (json: {}) => {
    const filteredList: Provider.Image[] = [] 
    for (const img of json?.data) {
        filteredList.push({
            url: img.path,
            link: img.url,
            download_link: img.path,
            color: img.colors[0],
        })
    }
    return filteredList
}
currentProvider.getDownloadUrl = (image) => {
    return image.download_link
}
currentProvider.getCredits = (image) => {
    let credit = document.createElement('a')
    credit.textContent = 'background by wallhaven'
    credit.href = image.link
    return [credit]
}
