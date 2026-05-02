
async function testCloudinary() {
  const CLOUD_NAME = 'dwen6h0ua';
  const UPLOAD_PRESET = 'famvault';
  const type = 'image';
  
  console.log('Testing Cloudinary upload for cloud:', CLOUD_NAME);
  
  const formData = new FormData();
  // Using a small 1x1 transparent pixel base64 as a mock file
  const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  formData.append('file', base64);
  formData.append('upload_preset', UPLOAD_PRESET);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${type}/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    console.log('Result:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

testCloudinary();
