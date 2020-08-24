import React, {Component} from 'react';
import {RootState} from "../../store/reducer";
import {Dispatch} from "redux";
import {connect, ConnectedProps} from "react-redux";
import {setConfig} from "../../store/module/haproxy/action";
import {Core} from "../../../../back/core/haproxy/types";
import {HaproxyApi} from "../../api/haproxy";
import FrontendContainer from "./frontend/FrontendContainer";
import BackendContainer from "./backend/BackendContainer";
import {Button} from "@material-ui/core";

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
            <div className={"Haproxy"}>
                <FrontendContainer/>
                <BackendContainer />
                <Button>Save</Button>
            </div>
        );
    }
}

export default connector(Haproxy);
