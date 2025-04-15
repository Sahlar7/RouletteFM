function selectRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Generates a random string for the state parameter in OAuth
const generateRandomString = (length) => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

module.exports = {
    selectRandom,
    generateRandomString,
};