import { useEffect, useState } from "react";
import type RpcInterface from "../beacon-rpc/RpcInterface";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import IconButton from "@mui/material/IconButton";
import Edit from "@mui/icons-material/Edit";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";

export function SavedMessages({ rpc }: { rpc?: RpcInterface }) {
    const [messages, setMessages] = useState<string[]>([]);

    useEffect(() => {
        if (!rpc) return;
        rpc.getSavedMessages().then(response => {
            setMessages(response.Messages);
        });
    }, [rpc]);

    const [newMessage, setNewMessage] = useState("");

    const handleSave = (idx: number, newMsg: string) => {
        if (!rpc) return;
        rpc.updateSavedMessage({ Idx: idx, Message: newMsg }).then(response => {
            if (response.Success) {
                setMessages(prev => prev.map((m, i) => i === idx ? newMsg : m));
            }
        });
    };

    const handleDelete = (idx: number) => {
        if (!rpc) return;
        rpc.deleteSavedMessage({ Idx: idx }).then(() => {
            setMessages(prev => prev.filter((_, i) => i !== idx));
        });
    };

    const handleAdd = () => {
        if (!rpc || !newMessage.trim()) return;
        rpc.addSavedMessage({ Message: newMessage }).then(() => {
            setMessages(prev => [...prev, newMessage]);
            setNewMessage("");
        });
    };

    return (
        <>
            <Typography sx={{ mt: 4, mb: 2 }} variant="h6" component="div">
                Saved Messages
            </Typography>
            {!rpc && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Connect a device to view and edit saved messages.
                </Alert>
            )}
            <Paper elevation={1}>
                <List>
                    {messages.map((msg, index) => (
                        <MessageItem idx={index} message={msg} key={index} onSave={handleSave} onDelete={handleDelete} />
                    ))}
                    <ListItem>
                        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="New message..."
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                                disabled={!rpc}
                            />
                            <Button variant="outlined" startIcon={<Add />} onClick={handleAdd} disabled={!rpc}>Add</Button>
                        </Stack>
                    </ListItem>
                </List>
            </Paper>
        </>
    );
}

function MessageItem({ idx, message, onSave, onDelete }: { idx: number; message: string; onSave: (idx: number, message: string) => void; onDelete: (idx: number) => void }) {
    const [editMode, setEditMode] = useState(false);
    const [draft, setDraft] = useState(message);

    useEffect(() => {
        setDraft(message);
    }, [message]);

    const handleSave = () => {
        onSave(idx, draft);
        setEditMode(false);
    };

    return (
        <ListItem
            key={idx}
            secondaryAction={
                editMode ?
                    null :
                    <Stack direction="row">
                        <IconButton aria-label="edit" onClick={() => setEditMode(true)}><Edit /></IconButton>
                        <IconButton edge="end" aria-label="delete" onClick={() => onDelete(idx)} color="error"><Delete /></IconButton>
                    </Stack>
            }>
            <ListItemText
                primary={editMode ?
                    <Stack direction="row" spacing={1}>
                        <TextField fullWidth size="small" value={draft} onChange={e => setDraft(e.target.value)} />
                        <Button variant="outlined" onClick={handleSave}>Save</Button>
                        <Button variant="outlined" color="error" onClick={() => { setDraft(message); setEditMode(false); }}>Cancel</Button>
                    </Stack> :
                    message} />
        </ListItem>
    );
}