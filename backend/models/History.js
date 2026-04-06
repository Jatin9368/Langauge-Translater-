const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
  {
    sourceText: {
      type: String,
      required: true,
      trim: true,
    },
    translatedText: {
      type: String,
      required: true,
      trim: true,
    },
    sourceLang: {
      type: String,
      required: true,
    },
    targetLang: {
      type: String,
      required: true,
    },
    sourceLangName: {
      type: String,
      default: '',
    },
    targetLangName: {
      type: String,
      default: '',
    },
    emotion: {
      type: String,
      default: null,
    },
    emotionText: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster pagination queries
historySchema.index({ createdAt: -1 });

module.exports = mongoose.model('History', historySchema);
