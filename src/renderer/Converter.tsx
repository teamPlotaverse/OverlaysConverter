import React, { useState, useEffect, useCallback } from 'react';

interface FileItem {
  path: string;
  name: string;
  progress: number;
}

function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    window.electron.onConversionProgress((event, { inputPath, progress }) => {
      setFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.path === inputPath ? { ...file, progress } : file,
        ),
      );
    });
  }, []);

  const addFiles = useCallback(async (newFiles: FileItem[]) => {
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    setProcessing(true);

    for (const file of newFiles) {
      try {
        await window.electron.convertVideo(file.path);
      } catch (error) {
        console.error('Error during conversion:', error);
      }
    }

    setProcessing(false);
  }, []);

  const pickDocuments = async () => {
    try {
      const result = await window.electron.openFile({
        filters: [{ name: 'Video', extensions: ['mov'] }],
        properties: ['openFile', 'multiSelections'],
      });

      if (result) {
        const newFiles: FileItem[] = result.map((filePath: string) => ({
          path: filePath,
          name: filePath.split(/[\\/]/).pop() || '',
          progress: 0,
        }));
        addFiles(newFiles);
      }
    } catch (err) {
      console.error('Error picking documents:', err);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const newFiles: FileItem[] = droppedFiles.map((file) => ({
      path: file.path,
      name: file.name,
      progress: 0,
    }));
    addFiles(newFiles);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        padding: 4,
        textAlign: 'center',
        backgroundColor: dragOver ? '#e8f5e9' : 'transparent',
        flex: 1,
      }}
    >
      <div
        style={{
          flex: 1,
          border: `2px dashed ${dragOver ? '#4caf50' : '#ccc'}`,
          borderRadius: 4,
          overflowY: 'scroll',
          padding: 20,
        }}
      >
        <h1>Overlays Converter</h1>

        <p>Select files or drag and drop them into the window</p>

        <button onClick={pickDocuments} type="button">
          Select ProRes Videos
        </button>

        <div style={{ marginTop: 40 }}>
          {files.map((file, index) => (
            <div style={{ marginBottom: 20 }} key={index}>
              <div>{file.name}</div>
              <div
                style={{
                  width: '100%',
                  height: '20px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: 5,
                  overflow: 'hidden',
                  marginTop: 5,
                }}
              >
                <div
                  style={{
                    width: `${file.progress}%`,
                    height: '100%',
                    backgroundColor: '#4caf50',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
