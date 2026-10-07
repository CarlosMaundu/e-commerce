// src/redux/fileSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { adminCatalog } from '../api';
import { friendlyError } from '../utils/friendlyError';
import { MESSAGES } from '../notification/messages';

/**
 * uploadFileThunk with optional onProgress callback for tracking.
 */
export const uploadFileThunk = createAsyncThunk(
  'files/uploadFile',
  async ({ file, onProgress }, { rejectWithValue }) => {
    try {
      const fileData = await adminCatalog.uploadFile(file, onProgress);
      return fileData;
    } catch (error) {
      return rejectWithValue(friendlyError(error, MESSAGES.file.uploadFailed));
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
