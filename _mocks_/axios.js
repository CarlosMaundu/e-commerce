// __mocks__/axios.js
const mockAxios = {
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  // Add other methods as needed
};

export default mockAxios;
