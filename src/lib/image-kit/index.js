import config from "../../config/env.js";
import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: config.imageKit.publicKey,
  privateKey: config.imageKit.privateKey,
  urlEndpoint: config.imageKit.urlEndpoint,
});

export const uploadImage = async (file, fileName, folder) => {
  try {
    // Upload the compressed image
    const response = await imagekit.upload({
      file: file,
      fileName: fileName,
      folder: folder,
      tags: [fileName],
    });

    return { url: response.url, fileId: response.fileId };
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
};

// Function to delete an image
export const deleteImage = async (fileId) => {
  try {
    await imagekit.deleteFile(fileId);
    console.log("File deleted successfully");
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};
