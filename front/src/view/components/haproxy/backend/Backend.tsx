import React from 'react';
import {Haproxy} from "../../../../../../back/src/controllers/haproxy/types";
import {
    Button,
    FormControlLabel,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    TextField
} from "@material-ui/core";
import {connect, ConnectedProps} from "react-redux";
import {Dispatch} from "redux";
import {backendActions} from "../../../../store/module/haproxy/action";
import './Backend.scss'
import CloseIcon from '@material-ui/icons/Close';
import {Add} from "@material-ui/icons";


const mapDispatchToProps = (dispatch: Dispatch, props: Props) => {
    const data: { name: string, data: Haproxy.Backend } = JSON.parse(JSON.stringify(props.data))
    const {name, data: backend} = data;

    const updateData = () => dispatch(backendActions.update(data))
    const remove = () => dispatch(backendActions.remove(name))


    return ({
        update: {
            mode: (val: Haproxy.Mode) => {
                backend.mode = val;
                updateData();
            },

            name: (val: string) => {
                remove()
                dispatch(backendActions.update({name: val, data: backend}));
            },

            server: backend.server.map(b => ({
                name: (val: string) => {
                    b.name = val;
                    updateData()
                },
                host: (val: string) => {
                    b.host = val;
                    updateData()
                },
                port: (val: number) => {
                    b.port = val;
                    updateData()
                },
                check: (val: boolean) => {
                    b.check = val;
                    updateData()
                }
            })),


            alter: {

                create: () => {
                    if (backend.alter.find(x => x.change.from === "" && x.change.to === "")) return;
                    backend.alter.push({thing: "url", condition: undefined, change: {from: "", to: ""}})
                    updateData()
                },

                remove: (index: number) => {
                    backend.alter = [...backend.alter.slice(0, index), ...backend.alter.slice(index + 1)];
                    updateData()
                },

                thing: (index: number, val: "url") => {
                    backend.alter[index].thing = val;
                    updateData()
                },

                condition: (index: number, val: string) => {
                    backend.alter[index].condition = val;
                    updateData()
                },
                change: {
                    from: (index: number, val: string) => {
                        backend.alter[index].change.from = val;
                        updateData()
                    },

                    to: (index: number, val: string) => {
                        backend.alter[index].change.to = val;
                        updateData()
                    },
                }
            }
        },
        remove: () => {
            dispatch(backendActions.remove(name))
        }
    });
}

const connector = connect(null, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;

interface Props {
    data: {
        name: string,
        data: Haproxy.Backend
    }
}

function Frontend(props: Props & ReduxTypes) {
    const {data: {data: {mode, alter, server}, name}} = props;

    return (
        <div className="Backend">
            <Grid container spacing={4} direction={"row"} className={"header"}>
                <Grid item xs={3}>
                    <TextField
                        id={"backend-name-" + name}
                        label="Name"
                        value={name}
                        className={"name"}
                        onChange={e => props.update.name(e.target.value)}/>
                </Grid>


                <Grid item container xs={6}>
                    {server.map((s, i) => <>
                        <Grid item xs={4}>
                            <TextField
                                id={"backend-host-" + name}
                                label="Server name"
                                value={s.name}
                                onChange={e => props.update.server[i].name(e.target.value)}/>
                        </Grid>

                        <Grid item xs={4}>
                            <TextField
                                id={"backend-server-host-" + name}
                                label="Server host"
                                value={s.host}
                                onChange={e => props.update.server[i].host(e.target.value)}/>
                        </Grid>

                        <Grid item xs={3}>
                            <TextField
                                id={"backend-port-" + name}
                                label="Server port"
                                value={s.port}
                                type={"number"}
                                onChange={e => props.update.server[i].port(Number.parseInt(e.target.value))}/>
                        </Grid>

                        <Grid item xs={1}>
                            <FormControlLabel
                                className={"server-check"}
                                checked={server[i].check}
                                control={<Switch size={"small"} checked={server[i].check} color="primary"
                                                 onChange={e => props.update.server[i].check(e.target.checked)}/>}
                                label="Check"
                                labelPlacement="top"
                            />
                        </Grid>

                    </>)}
                </Grid>

                <Grid item xs={1}>
                    <InputLabel className={"select-label"} id={"backend-select-mode-" + name}>Mode</InputLabel>
                    <Select
                        labelId={"backend-select-mode-" + name}
                        value={mode}
                        onChange={(e) => props.update.mode(e.target.value as Haproxy.Mode)}
                    >
                        <MenuItem value={"http"}>HTTP</MenuItem>
                        <MenuItem value={"tcp"}>TCP</MenuItem>
                    </Select>
                </Grid>


                <Grid item xs={1}/>
                <Grid item xs={3}>
                    <Button color={"secondary"} className={"create-btn"} onClick={props.update.alter.create}>Add Rewrite<Add/></Button>
                </Grid>
                <Grid item xs={9}>
                    {alter.map((b, i) =>
                        <div key={i} className={"alter"}>
                            <div className="backend-name">
                                <InputLabel className={"select-label"}
                                            id={`backend-select-backend-${name}-${i}`}>Backend</InputLabel>
                                <Select
                                    labelId={`select-thing-${name}-${i}`}
                                    value={b.thing}
                                    onChange={(e) => props.update.alter.thing(i, e.target.value as any)}
                                >
                                    <MenuItem value={"url"}>URL</MenuItem>
                                </Select>

                            </div>
                            <TextField
                                id={`condition-${name}-${i}`}
                                label="Condition"
                                value={b.condition}
                                onChange={e => props.update.alter.condition(i, e.target.value)}/>

                            <TextField
                                id={`alter-from-${name}-${i}`}
                                label="Rewrite from"
                                value={b.change.from}
                                onChange={e => props.update.alter.change.from(i, e.target.value)}/>

                            <TextField
                                id={`alter-change-${name}-${i}`}
                                label="Rewrite to"
                                value={b.change.to}
                                onChange={e => props.update.alter.change.to(i, e.target.value)}/>


                            <IconButton className={"remove-backend-btn"} onClick={() => props.update.alter.remove(i)}>
                                <CloseIcon fontSize={"small"}/>
                            </IconButton>


                        </div>
                    )}
                </Grid>


            </Grid>

            <IconButton className={"close-btn"} onClick={props.remove}><CloseIcon/></IconButton>
        </div>
    );
}

export default connector(Frontend);
