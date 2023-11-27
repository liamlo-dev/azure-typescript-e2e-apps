import { BlockBlobClient } from '@azure/storage-blob';
import { ListItemText, CardContent, TextField, Box, Button, Card, CardMedia, Grid, Typography } from '@mui/material';
import { ChangeEvent, useState } from 'react';
import ErrorBoundary from './components/error-boundary';
import { convertFileToArrayBuffer } from './lib/convert-file-to-arraybuffer';
import { useCallback, useEffect } from 'react';
import InputAdornment from '@mui/material/InputAdornment';

import axios, { AxiosResponse } from 'axios';
import './App.css';
import React from 'react';

// Used only for local development
const API_SERVER = import.meta.env.VITE_API_SERVER as string;

const request = axios.create({
  baseURL: API_SERVER,
  headers: {
    'Content-type': 'application/json'
  }
});

type SasResponse = {
  url: string;
};
type ListResponse = {
  list: string[];
};

function App({ username }) {
  // username = "admin"

  const [searchTerm, setSearchTerm] = useState("");

  const [dataList, setDataList] = useState([]);
  const showList = useCallback(async () => {
    const endpoint = '/data-api/rest/media';
    try {
      const response = await fetch(endpoint);
      const data = await response.json();

      // Map through the data to update the keywords property of each item
      const updatedData = data.value.map(item => {
        if (item.keywords) {
          // Split the keywords string by comma and trim whitespace
          const keywordsArray = item.keywords.split(',').map(keyword => keyword.trim());
          return { ...item, keywords: keywordsArray };
        }
        return item;
      });

      setDataList(updatedData); // update the state with the fetched and processed data
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, []);
  console.log(dataList)

  const [getId, setGetId] = useState("");
  const [dataById, setDataById] = useState({});
  const getDataById = useCallback(async () => {
    const endpoint = `/data-api/rest/media/id`;
    try {
      const response = await fetch(`${endpoint}/${getId}`);
      if (!response.ok) throw new Error('Failed to get data');
      const data = await response.json();
      setDataById(data);
    } catch (error) {
      console.error('Failed to get data:', error);
    }
  }, [getId]);

  const [updateId, setUpdateId] = useState("");
  const [updateName, setUpdateName] = useState("");
  const [updateDate, setUpdateDate] = useState("");
  const [updateDescription, setUpdateDescription] = useState("");
  const [updateKeywords, setUpdateKeywords] = useState("");

  const updateData = useCallback(async () => {
    const endpoint = `/data-api/rest/media/id`;
    const data = {
      name: updateName,
      date: updateDate,
      description: updateDescription,
      keywords: updateKeywords,
    };
    try {
      const response = await fetch(`${endpoint}/${updateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update data');
      // Get the updated data list after update
      showList();
    } catch (error) {
      console.error('Failed to update data:', error);
    }
  }, [updateId, updateName, updateDate, updateDescription, updateKeywords, showList]);

  const [mediaName, setMediaName] = useState("");
  const [mediaDescription, setMediaDescription] = useState("");
  const [mediaDate, setMediaDate] = useState("");
  const [mediaKeywords, setMediaKeywords] = useState("");
  const [blobReference, setBlobReference] = useState("");

  const createData = useCallback(async () => {
    console.log(blobReference)
    const endpoint = `/data-api/rest/media`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: mediaName,
          description: mediaDescription,
          date: mediaDate,
          keywords: mediaKeywords,
          blob_reference: blobReference,
        }),
      });
      if (!response.ok) throw new Error('Failed to create data');
      // refresh the displayed data after creating
      showList();
    } catch (error) {
      console.error('Failed to create data:', error);
    }
  }, [mediaName, mediaDescription, mediaDate, mediaKeywords, blobReference, showList]);

  const deleteData = useCallback(() => async (id) => {
    const endpoint = `/data-api/rest/media/id`;
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete data');
      // refresh the displayed data after deleting
      showList();
    } catch (error) {
      console.error('Failed to delete data:', error);
    }
  }, [showList]);

  const containerName = `upload`;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sasTokenUrl, setSasTokenUrl] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [list, setList] = useState<string[]>([]);

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const { target } = event;

    if (!(target instanceof HTMLInputElement)) return;
    if (
      target?.files === null ||
      target?.files?.length === 0 ||
      target?.files[0] === null
    )
      return;

    setSelectedFile(target?.files[0]);

    // reset
    setSasTokenUrl('');
    setUploadStatus('');
  };

  useEffect(() => {
    if (selectedFile) {
      handleFileSasToken();
      setBlobReference(selectedFile.name);
    }
  }, [selectedFile]);

  const handleFileSasToken = () => {
    const permission = 'w'; //write
    const timerange = 5; //minutes

    if (!selectedFile) return;

    request
      .post(
        `/api/sas?file=${encodeURIComponent(
          selectedFile.name
        )}&permission=${permission}&container=${containerName}&timerange=${timerange}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      .then((result: AxiosResponse<SasResponse>) => {
        const { data } = result;
        const { url } = data;
        setSasTokenUrl(url);
      })
      .catch((error: unknown) => {
        if (error instanceof Error) {
          const { message, stack } = error;
          setSasTokenUrl(`Error getting sas token: ${message} ${stack || ''}`);
        } else {
          setUploadStatus(error as string);
        }
      });
  };

  const handleFileUpload = () => {
    if (sasTokenUrl === '') return;

    convertFileToArrayBuffer(selectedFile as File)
      .then((fileArrayBuffer) => {
        if (
          fileArrayBuffer === null ||
          fileArrayBuffer.byteLength < 1 ||
          fileArrayBuffer.byteLength > 256000
        )
          return;

        const blockBlobClient = new BlockBlobClient(sasTokenUrl);
        return blockBlobClient.uploadData(fileArrayBuffer);
      })
      .then(() => {
        setUploadStatus('Successfully finished upload');
        return request.get(`/api/list?container=${containerName}`);
      })
      .then((result: AxiosResponse<ListResponse>) => {
        // Axios response
        const { data } = result;
        const { list } = data;
        setList(list);
        console.log(list)
      })
      .catch((error: unknown) => {
        if (error instanceof Error) {
          const { message, stack } = error;
          setUploadStatus(
            `Failed to finish upload with error : ${message} ${stack || ''}`
          );
        } else {
          setUploadStatus(error as string);
        }
      });
  };

  useEffect(() => {
    if (uploadStatus === 'Successfully finished upload') {
      console.log(blobReference)
      createData();
      setUploadStatus(''); // Reset uploadStatus here OK
      showList();
    }
  }, [uploadStatus, createData, showList]);

  return (
    <>
      <ErrorBoundary>
        <Box m={4}>
          {/* App Title */}
          <Typography variant="h4" gutterBottom>
            Welcome, {username}!
          </Typography>
          {/* <Typography variant="h5" gutterBottom>
            with SAS token
          </Typography>
          <Typography variant="body1" gutterBottom>
            <b>Container: {containerName}</b>
          </Typography> */}

          {/* SAS Token Section */}
          {/* {selectedFile && selectedFile.name && (
            <Box
              display="block"
              justifyContent="left"
              alignItems="left"
              flexDirection="column"
              my={4}
            >
              <Button variant="contained" onClick={handleFileSasToken}>
                Get SAS Token
              </Button>
              {sasTokenUrl && (
                <Box my={2}>
                  <Typography variant="body2">{sasTokenUrl}</Typography>
                </Box>
              )}
            </Box>
          )} */}

          {/* File Upload Section
          {sasTokenUrl && (
            <Box
              display="block"
              justifyContent="left"
              alignItems="left"
              flexDirection="column"
              my={4}
            >
              <Button variant="contained" onClick={handleFileUpload}>
                Upload
              </Button>
              {uploadStatus && (
                <Box my={2}>
                  <Typography variant="body2" gutterBottom>
                    {uploadStatus}
                  </Typography>
                </Box>
              )}
            </Box>
          )} */}

          {/* Table Display */}
          {/* <Button id="list" onClick={showList}>List</Button>

          <Typography variant="h4" gutterBottom>Data List</Typography>
          {dataList.map((item, index) => (
            <div key={index}>
              {Object.entries(item).map(([key, value]) => (
                <Typography variant="body1" gutterBottom>{`${key}: ${value}`}</Typography>
              ))}
            </div>
          ))} */}

          {/* Input */}
          {/* <Box my={2}>
            <Typography variant="body1" gutterBottom>
              Enter an ID to retrieve an entry:
            </Typography>
            <input
              type="text"
              placeholder="ID"
              value={getId}
              onChange={e => setGetId(e.target.value)}
            />
            <Button variant="contained" onClick={getDataById}>
              Get Data
            </Button>
          </Box>

          {Object.keys(dataById).length > 0 && (
            <Box my={2}>
              <Typography variant="body1" gutterBottom>
                Retrieved Data:
              </Typography>
              <pre>{JSON.stringify(dataById, null, 2)}</pre>
            </Box>
          )}

          <Box my={2}>
            <Typography variant="body1" gutterBottom>
              Enter an ID and new values to update an entry:
            </Typography>
            <input
              type="text"
              placeholder="ID"
              value={updateId}
              onChange={e => setUpdateId(e.target.value)}
            />
            <input
              type="text"
              placeholder="Name"
              value={updateName}
              onChange={e => setUpdateName(e.target.value)}
            />
            <input
              type="date"
              value={updateDate}
              onChange={e => setUpdateDate(e.target.value)}
            />
            <input
              type="text"
              placeholder="Description"
              value={updateDescription}
              onChange={e => setUpdateDescription(e.target.value)}
            />
            <input
              type="text"
              placeholder="Keywords"
              value={updateKeywords}
              onChange={e => setUpdateKeywords(e.target.value)}
            />
            <Button variant="contained" onClick={updateData}>
              Update Entry
            </Button>
          </Box> */}

          {/* <Box my={2}>
            <Typography variant="body1" gutterBottom>
              Enter new values to create a new entry:
            </Typography>
            <input
              type="text"
              placeholder="Name"
              value={mediaName}
              onChange={e => setMediaName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Description"
              value={mediaDescription}
              onChange={e => setMediaDescription(e.target.value)}
            />
            <input
              type="date"
              value={mediaDate}
              onChange={e => setMediaDate(e.target.value)}
            />
            <input
              type="text"
              placeholder="Keywords"
              value={mediaKeywords}
              onChange={e => setMediaKeywords(e.target.value)}
            />
            <input
              type="text"
              placeholder="Blob Reference"
              value={blobReference}
              onChange={e => setBlobReference(e.target.value)}
            />
            <Button variant="contained" onClick={createData}>
              Create Data
            </Button>
          </Box> */}

          {/* <Box my={2}>
            <Typography variant="body1" gutterBottom>
              Enter an ID to delete an entry:
            </Typography>
            <input
              type="text"
              placeholder="ID"
              value={deleteId}
              onChange={e => setDeleteId(e.target.value)}
            />
            <Button variant="contained" onClick={deleteData}>
              Delete Data
            </Button>
          </Box> */}

          {/* Key part */}
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            padding={3}
          >
            <Typography variant="h4" component="h1" gutterBottom>
              Upload Media
            </Typography>
            <TextField
              label="Name"
              value={mediaName}
              onChange={(e) => setMediaName(e.target.value)}
              margin="normal"
            />
            <TextField
              label="Description"
              value={mediaDescription}
              onChange={(e) => setMediaDescription(e.target.value)}
              margin="normal"
            />
            <TextField
              label="Date"
              value={mediaDate}
              onChange={(e) => setMediaDate(e.target.value)}
              type="date"
              InputLabelProps={{
                shrink: true,
              }}
              margin="normal"
            />
            <TextField
              label="Keywords"
              value={mediaKeywords}
              onChange={(e) => setMediaKeywords(e.target.value)}
              margin="normal"
            />

            {/* File Selection Section */}
            <Box
              display="block"
              justifyContent="left"
              alignItems="left"
              flexDirection="column"
              my={4}
            >
              <Button variant="contained" component="label">
                Select File
                <input type="file" hidden onChange={handleFileSelection} />
              </Button>
              {selectedFile && selectedFile.name && (
                <Box my={2}>
                  <Typography variant="body2">{selectedFile.name}</Typography>
                </Box>
              )}
            </Box>
            <Button
              variant="contained"
              color="secondary"
              type="submit"
              onClick={handleFileUpload}
              disabled={!selectedFile || !sasTokenUrl}
              style={{ marginTop: '20px' }}
            >
              Submit
            </Button>

            {uploadStatus && (
              <Typography color="error" align="center">
                {uploadStatus}
              </Typography>
            )}

          </Box>

          {/* Uploaded Files Display */}
          {/* <Grid container spacing={2}>
            {list.map((item) => (
              <Grid item xs={6} sm={4} md={3} key={item}>
                <Card>
                  {item.endsWith('.jpg') ||
                    item.endsWith('.png') ||
                    item.endsWith('.jpeg') ||
                    item.endsWith('.gif') ? (
                    <CardMedia component="img" image={item} alt={item} />
                  ) : (
                    <Typography variant="body1" gutterBottom>
                      {item}
                    </Typography>
                  )}
                </Card>
              </Grid>
            ))}
          </Grid> */}

          <TextField
            label="Search"
            variant="outlined"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                </InputAdornment>
              ),
            }}
            style={{ marginBottom: '20px' }} // Add some space below the search bar
          />

          <Grid container spacing={2}>
            {dataList.filter((data) => {
              // Check if the name or any keyword matches the search term
              return data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (data.keywords && data.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm.toLowerCase())));
            }).map((data, index) => (
              <Grid item xs={6} sm={4} md={3} key={data.id}>
                <Card>
                  <CardMedia
                    component="img"
                    image={`https://m5q9ovdj57x4.blob.core.windows.net/upload/${data.blob_reference}`}
                    alt={data.name}
                  />
                  <CardContent>
                    <Typography variant="h5" component="div">
                      Name: {data.name || ' '}
                    </Typography>
                    <ListItemText
                      secondary={
                        <React.Fragment>
                          <div>
                            <Typography component="span" variant="body2" color="textPrimary">
                              Date: {data.date ? new Date(data.date).toLocaleDateString() : ' '}
                            </Typography>
                          </div>
                          <div>
                            <Typography component="span" variant="body2" color="textPrimary">
                              Description: {data.description || ' '}
                            </Typography>
                          </div>
                          {data.keywords && (
                            <div>
                              <Typography component="span" variant="body2" color="textPrimary">
                                Keywords: {data.keywords.join(', ') || ' '}
                              </Typography>
                            </div>
                          )}
                        </React.Fragment>
                      }
                    />

                    {username === 'admin' && (
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={(event) => {
                          event.stopPropagation(); // Prevent the Card onClick event from firing
                          if (window.confirm(`Are you sure you want to delete entry with ID: ${data.id}?`)) {
                            deleteData()(data.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    )}


                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

        </Box>
      </ErrorBoundary >
    </>
  );
}

export default App;
