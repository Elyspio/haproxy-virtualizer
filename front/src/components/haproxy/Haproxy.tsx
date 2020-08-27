import React, {Component} from 'react';
import {RootState} from "../../store/reducer";
import {Dispatch} from "redux";
import {connect, ConnectedProps} from "react-redux";
import {setConfig} from "../../store/module/haproxy/action";
import {Core} from "../../../../back/core/haproxy/types";
import {HaproxyApi} from "../../api/haproxy";
import FrontendContainer from "./frontend/FrontendContainer";
import BackendContainer from "./backend/BackendContainer";
import {Button, ButtonGroup, Container, Divider} from "@material-ui/core";
import "./Haproxy.scss"

const mapStateToProps = (state: RootState) => ({config: state.haproxy.config})

const mapDispatchToProps = (dispatch: Dispatch) => ({setConfig: (conf: Core.Config) => dispatch(setConfig(conf))})

const connector = connect(mapStateToProps, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;


class Haproxy extends Component<ReduxTypes> {

    async componentDidMount() {
        const conf = await HaproxyApi.instance.getConfig();
        this.props.setConfig(conf);
    }

    render() {
        return (
            <Container className={"Haproxy"}>
                <FrontendContainer/>
                <Divider className={"divider"}/>
                <BackendContainer/>
                <Divider className={"divider"}/>
                <Button color={"primary"} className={"action-btn"} variant={"outlined"} onClick={this.save}>Save on server</Button>

                <ButtonGroup variant={"contained"}>
                    <Button color={"secondary"} className={"action-btn"} variant={"outlined"} onClick={this.download}>Download</Button>
                    <Button color={"secondary"} className={"action-btn"} variant={"outlined"}>Upload</Button>
                </ButtonGroup>
            </Container>
        );
    }

    private download = () => HaproxyApi.instance.download(this.props.config);

    private save = () => HaproxyApi.instance.setConfig(this.props.config);
}


export default connector(Haproxy);
