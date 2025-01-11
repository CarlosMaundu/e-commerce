// src/redux/fileSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { uploadFile } from '../services/fileService';

/**
 * uploadFileThunk with optional onProgress callback for tracking.
 */
export const uploadFileThunk = createAsyncThunk(
  'files/uploadFile',
  async ({ file, onProgress }, { rejectWithValue }) => {
    try {
      // The second argument to uploadFile can be onProgress for Axios
      const fileData = await uploadFile(file, onProgress);
      return fileData;
    } catch (error) {
      return rejectWithValue(error.message || 'File upload failed');
    }
  }
);

const fileSlice = createSlice({
  name: 'files',
  initialState: {
    files: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearFiles(state) {
      state.files = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(uploadFileThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadFileThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Optionally store the uploaded file info
        state.files.push(action.payload);
      })
      .addCase(uploadFileThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'File upload failed';
      });
  },
});

export const { clearFiles } = fileSlice.actions;
export default fileSlice.reducer;
