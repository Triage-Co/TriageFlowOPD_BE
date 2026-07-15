import axios from 'axios';
import * as fs from 'fs';

async function main() {
  const url = 'http://localhost:3000/api/navigation/building/17854b86-79d1-4c60-b776-784742c2597e/3d';
  console.log('Sending request to:', url);
  try {
    const res = await axios.get(url);
    console.log('Response Status:', res.status);
    console.log('Response Headers:', res.headers);
    const html = res.data;
    console.log('HTML Length:', html.length);
    fs.writeFileSync('docs/test-3d-node.html', html);
    console.log('Saved to docs/test-3d-node.html successfully!');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios Error:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
    } else {
      console.error('Unknown Error:', error);
    }
  }
}

main();
