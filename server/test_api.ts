import axios from 'axios';

const testProfile = async () => {
    try {
        const response = await axios.get('http://127.0.0.1:3000/v1/users/profile', {
            headers: {
                // Need a token here... maybe I can find one in the environment or user's logs
            }
        });
        console.log('Response:', response.data);
    } catch (error: any) {
        console.error('Error Status:', error.response?.status);
        console.error('Error Data:', error.response?.data);
    }
};
