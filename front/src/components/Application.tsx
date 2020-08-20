import * as React from 'react';
import {Paper, Typography} from "@material-ui/core";
import "./Application.scss"
import {connect, ConnectedProps} from "react-redux";
import {Dispatch} from "redux";
import {RootState} from "../store/reducer";
import {toggleTheme} from "../store/module/theme/action";
import Appbar from "./Appbar/Appbar";
import {Interactor} from "../api/Interactor";
import Drawer from "@bit/elyspio.test.drawer/dist/Drawer";
import Brightness5Icon from '@material-ui/icons/Brightness5';

const mapStateToProps = (state: RootState) => ({theme: state.theme.current})

const mapDispatchToProps = (dispatch: Dispatch) => ({toggleTheme: () => dispatch(toggleTheme())})

const connector = connect(mapStateToProps, mapDispatchToProps);
type ReduxTypes = ConnectedProps<typeof connector>;

export interface Props {
}

interface State {
    something: object
}

class Application extends React.Component<Props & ReduxTypes, State> {

    state = {something: {}}

    async componentDidMount() {
        this.setState({
            something: await Interactor.instance.test
        })
    }

    render() {

        const {toggleTheme} = this.props;

        return (
            <Paper square={true} className={"Application"}>
                <Drawer position={"right"} actions={[{onClick: toggleTheme, text: "Switch lights", icon: <Brightness5Icon/>}]}>
                    <div className="content">
                        <Appbar appName={"TEMPLATE"}/>
                        <Paper square>
                            <Typography variant={"subtitle1"}> Server is running on {JSON.stringify(this.state.something)}</Typography>
                        </Paper>
                    </div>


                </Drawer>

            </Paper>
        );
    }
}

export default connector(Application)
