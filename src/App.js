import React, { useState, useEffect } from 'react';
import './App.css';
import { API, Storage } from 'aws-amplify';
import { withAuthenticator, AmplifySignOut } from '@aws-amplify/ui-react';
import { listNotes } from './graphql/queries';
import { createNote as createNoteMutation, deleteNote as deleteNoteMutation } from './graphql/mutations';

const initialFormState = { name: '', description: '' }

function App() {
  const [notes, setNotes] = useState([]);
  const [formData, setFormData] = useState(initialFormState);

  // Our DynamoDB can only hold image string. Our S3 holds actual image.
  // Our formData state is what we submit to DynamoDB, so it will hold image (string)
  // while our notes state will hold the actual image

  // on component mount, fetch notes data from DynamoDB via API
  useEffect(() => {
    fetchNotes();
  }, []);

  // fetch our notes data from DynamoDB, images from S3; store in notes state
  async function fetchNotes() {
    // query DynamoDB for our list of notes
    const apiData = await API.graphql({ query: listNotes });
    const notesFromAPI = apiData.data.listNotes.items;
    // for each note:
    await Promise.all(notesFromAPI.map(async note => {
      // if note object has an image property (string)
      if (note.image) {
        // query S3 for actual image
        const image = await Storage.get(note.image);
        // replace current note's image property value (string) with actual image
        note.image = image;
      }
    }))
    // update local notes state
    setNotes(notesFromAPI);
  }

  // handle image upload
  async function onChange(e) {
      // if empty, no image was uploaded, so return
      if (!e.target.files[0]) return
      const file = e.target.files[0];
      // add 'image' property (string) to formData object in state
      setFormData({ ...formData, image: file.name });
      // store our image in S3 along with associated filename string
      await Storage.put(file.name, file);
      // fetchNotes(); don't know why their code had this call
  }

  // create note handler
  async function createNote() {
    // if either name or description field is blank, return
    if (!formData.name || !formData.description) return;
    // persist our form data to DynamoDB
    await API.graphql({ query: createNoteMutation, variables: { input: formData } });
    // if note has image (string), get actual image and add it to local notes array
    if (formData.image) {
      // formData.image is a string, which we use to get actual image from S3
      const image = await Storage.get(formData.image);
      // replace image property value (string) with actual image 
      formData.image = image;
    }
    // add our new note with actual image to our local notes state
    setNotes([ ...notes, formData ]);
    // reset form state
    setFormData(initialFormState);
  }

  async function deleteNote({ id }) {
    const newNotesArray = notes.filter(note => note.id !== id);
    setNotes(newNotesArray);
    await API.graphql({ query: deleteNoteMutation, variables: { input: { id } }});
  }

  return (
    <div className="App">
      <h1>My Notes App</h1>
      <input
        onChange={e => setFormData({ ...formData, 'name': e.target.value})}
        placeholder="Note name"
        value={formData.name}
      />
      <input
        onChange={e => setFormData({ ...formData, 'description': e.target.value})}
        placeholder="Note description"
        value={formData.description}
      />
      <input
        type="file"
        onChange={onChange}
      />
      <button onClick={createNote}>Create Note</button>
      <div style={{marginBottom: 30}}>
        {
          // render each note from notes state. if a note has img property, render it.
          notes.map(note => (
            <div key={note.id || note.name}>
              <h2>{note.name}</h2>
              <p>{note.description}</p>
              <button onClick={() => deleteNote(note)}>Delete note</button>
              {
                note.image && <img src={note.image} style={{width: 400}} alt="" />
              }
            </div>
          ))
        }
      </div>
      <AmplifySignOut />
    </div>
  );
}

export default withAuthenticator(App);