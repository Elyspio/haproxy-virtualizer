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
import {frontendActions} from "../../../../store/module/haproxy/action";
import './Frontend.scss'
import CloseIcon from '@material-ui/icons/Close';
import {Add} from "@material-ui/icons";
import BindContainer from "./bind/BindContainer";
import deepClone from "lodash.clonedeep"
import {StoreState} from "../../../../store";

const mapStateToProps = (state: StoreState) => ({
    backends: state.haproxy.config?.backends,
    frontends: state.haproxy.config?.frontends
})

type Frontend = { name: string, data: Haproxy.Frontend };

const mapDispatchToProps = (dispatch: Dispatch, props: Props) => {
    const clone = (): Frontend => deepClone(props.data)
    const data = clone()
    let {name, data: frontend} = data;

    const updateData = (d?: Frontend) => dispatch(frontendActions.update(d ?? data))
    const remove = () => dispatch(frontendActions.remove(name))
    console.log("DO")

    return {
        update: {
            mode: (val: Haproxy.Mode) => {
                frontend.mode = val;
                updateData();
            },
            name: (val: string) => {
                remove()
                dispatch(frontendActions.update({name: val, data: frontend}));
            },
            // used in component Bind.tsx
            bind: {
                host: (index: number, val: string) => {
                    frontend.bind[index].host = val;
                    updateData();
                },
                port: (index: number, val: number) => {
                    const data = clone();
                    data.data.bind[index].port = val;
                    updateData(data);
                },
                ssl: (index: number, val?: string) => {
                    console.log("val", val, "front", frontend)
                    const data = clone();
                    data.data.bind[index].ssl = val;
                    updateData(data)
                },
                create: () => {
                    frontend.bind.push({
                        ssl: undefined,
                        host: "",
                        port: 0
                    })
                    updateData()
                },
                remove: (index: number) => {
                    frontend.bind = [...frontend.bind.slice(0, index), ...frontend.bind.slice(index + 1)];
                    updateData()
                }
            },


            ssl: {
                redirect: (val: boolean) => {
                    frontend.ssl = {
                        redirect: val
                    }
                    updateData();
                }
            },

            backend: {
                create: () => {
                    if (frontend.backends.find(x => x.name === "")) return;
                    frontend.backends.push({name: "", condition: undefined})
                    updateData();
                },

                remove: (index: number) => {
                    frontend.backends = [
                        ...frontend.backends.slice(0, index),
                        ...frontend.backends.slice(index + 1),
                    ]
                    updateData()
                },

                name: (index: number, next: string) => {

                    const currentBackend = frontend.backends[index];
                    currentBackend.name = next;
                    updateData()
                },

                condition: (index: number, val: string) => {
                    const currentBackend = frontend.backends[index];
                    currentBackend.condition = val.length ? val : undefined;
                    updateData();
                }
            }
        },
        remove: () => remove()
    }
}

export type MapDispatchFrontend = ReturnType<typeof mapDispatchToProps>

const connector = connect(mapStateToProps, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;

interface Props {
    data: Frontend
}


function Frontend(props: Props & ReduxTypes) {
    const {data: {data: {mode, backends, bind, ssl}, name}} = props;
    const storeBackends = Object.entries(props.backends).map(([name, backend]) => ({name, data: backend}))
    return (
        <div className="Frontend">
            <Grid container spacing={4} direction={"row"} className={"header"}>
                <Grid item xs={3}>
                    <TextField
                        id={"front-name-" + name}
                        label="Name"
                        value={name}
                        className={"name"}
                        onChange={e => props.update.name(e.target.value)}/>
                </Grid>


                <Grid item xs={1}>
                    <InputLabel className={"select-label"} id={"select-mode-" + name}>Mode</InputLabel>
                    <Select
                        labelId={"front-select-mode-" + name}
                        value={mode}
                        onChange={(e) => props.update.mode(e.target.value as Haproxy.Mode)}
                    >
                        <MenuItem value={"http"}>HTTP</MenuItem>
                        <MenuItem value={"tcp"}>TCP</MenuItem>
                    </Select>
                </Grid>

                <Grid item xs={2}>
                    <FormControlLabel
                        className={"server-check"}
                        checked={ssl?.redirect || false}
                        control={<Switch size={"small"} checked={ssl?.redirect || false} color="primary"
                                         onChange={e => props.update.ssl.redirect(e.target.checked)}/>}
                        label="Redirect to https"
                        labelPlacement="top"
                    />
                </Grid>


                <Grid item xs={6}/>

                <BindContainer data={bind} update={props.update} frontendName={name}/>

                <Grid item xs={3}>
                    <Button color={"secondary"} className={"create-btn"} onClick={props.update.backend.create}>Use
                        backend<Add/></Button>
                </Grid>
                <Grid item xs={9}>
                    {backends.map((b, i) =>
                        <div key={i} className={"backend"}>
                            <div className="backend-name">
                                <InputLabel className={"select-label"}
                                            id={`select-backend-${name}-${i}`}>Backend</InputLabel>
                                <Select
                                    labelId={`front-select-backend-${name}-${i}`}
                                    value={b.name}
                                    onChange={(e) => props.update.backend.name(i, e.target.value as string)}
                                >
                                    {storeBackends.map((sb, i) => <MenuItem key={i}
                                                                            value={sb.name}>{sb.name}</MenuItem>)}
                                </Select>

                            </div>
                            <TextField
                                id={`condition-${name}-${i}`}
                                label="Condition"
                                value={b.condition}
                                onChange={e => props.update.backend.condition(i, e.target.value)}/>

                            <IconButton className={"remove-backend-btn"} onClick={() => props.update.backend.remove(i)}>
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
