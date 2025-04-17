// DS
import picto                          from '@core/resources/assets/images/yeap/picto-yeap.png';
import cn                             from 'classnames';
import {
    type FC,
    useMemo,
    Fragment,
    useState,
    useCallback
}                                     from 'react';
import { FontAwesomeIcon }            from '@fortawesome/react-fontawesome';
import { getDateFormat }              from '@library/utils/dates';
import { getFormattedDecimalDigits }  from '@library/utils/number';
import { useSearch }                  from '@library/utils/search';
import { useTable }                   from '@library/utils/table';
import {
    YpTab,
    YpTag,
    YpMenu,
    YpInput,
    YpTable,
    YpButton,
    YpElement,
    YpTagsList,
    useYpModal,
    YpDataTable,
    YpTypography,
    YpConfirmModal
}                                     from 'ds';
import {
    map,
    max,
    find,
    some,
    filter,
    orderBy,
    capitalize
}                                     from 'lodash';
import { conjugate }                  from 'yutils/text';
import type { TDataProviderReturn }   from '@core/models/ProviderModel';
import type { IconProp }              from '@fortawesome/fontawesome-svg-core';
import type { TTailwindColorPalette } from 'ds';
import type {
    FC,
    ChangeEvent
}                                     from 'react';

// @app/dossier
import AdhesionFormComponent            from '@app/dossier/components/parametrage-dossier/adhesions-cotisations/adhesions/AdhesionFormComponent';
import CotisationAdhesionsFormComponent from '@app/dossier/components/parametrage-dossier/adhesions-cotisations/cotisations/CotisationAdhesionsFormComponent';
import CotisationFormComponent          from '@app/dossier/components/parametrage-dossier/adhesions-cotisations/cotisations/CotisationFormComponent';
import FichePopulationsFormComponent    from '@app/dossier/components/parametrage-dossier/adhesions-cotisations/FichePopulationsFormComponent';
import MetaDataModalComponent           from '@app/dossier/components/parametrage-dossier/adhesions-cotisations/MetaDataModalComponent';
import FieldVisibiliteEnum              from '@app/dossier/models/enums/FieldVisibiliteEnum';
import useTableReferenceDetailProvider  from '@app/dossier/providers/tablesReference/TableReferenceDetailProvider';
import { useAdhesionsListDefinition }   from '@app/dossier/components/parametrage-dossier/adhesions-cotisations/adhesions/utils/useAdhesionsListDefinition';
import { DonneeTypeEnum }               from '@app/dossier/models/enums/DonneeContextuelle';
import { useFicheMultiDelete }          from '@app/dossier/providers/fiches/FicheMultiDeleteProvider';
import { getValorisationValue }         from '@app/dossier/providers/historique/HistorisationDetailProvider';
import { useReferencialContext }        from '@app/dossier/providers/referencial/ReferencialContextProvider';
import {
    datas,
    getDCByCodeGroupement
}                                       from '@app/dossier/utils/fiche';
import type TypeCotisationModel         from '@app/dossier/models/adhesions/cotisations/TypeCotisationModel';
import type FamilleAdhesionModel        from '@app/dossier/models/adhesions/famille/FamilleAdhesionModel';
import type DonneeContextuelleModel     from '@app/dossier/models/DonneeContextuelleModel';
import type HistorisationModel          from '@app/dossier/models/fiches/HistorisationModel';
import type PopulationModel             from '@app/dossier/models/populations/PopulationModel';
import type SqueletteFicheModel         from '@app/dossier/models/SqueletteFicheModel';
import type TableReferenceModel         from '@app/dossier/models/TableReferenceModel';


type TTab = 'cotisation' | 'adhesions';

type TProps = {
    famille: FamilleAdhesionModel | null;
    cotisation: HistorisationModel | null;
    organismesList: TableReferenceModel | null;
    type_cotisation: TypeCotisationModel | null;
    fichesList?: TDataProviderReturn<HistorisationModel[]>;
    squelettesList?: TDataProviderReturn<SqueletteFicheModel[]>;
}

const CotisationDetailComponent: FC<TProps> = (props) => {

    // Variables
    const {
        famille,
        cotisation,
        fichesList,
        organismesList,
        squelettesList,
        type_cotisation
    } = props;

    const [ searchText, setSearchText ] = useState('');
    const [ currentTab, setCurrentTab ] = useState<TTab>('cotisation');
    const [ currentFicheId, setCurrentFicheId ] = useState<string | null>(null);

    // Contexts
    const referencialContext = useReferencialContext();

    // Hooks
    const {
        isOpen: isPopulationsOpen,
        toggleModal: togglePopulationsModal
    } = useYpModal();

    const {
        isOpen: isCotisationAdhesionsOpen,
        toggleModal: toggleCotisationAdhesionsModal
    } = useYpModal();

    const {
        isOpen: isCotisationOpen,
        toggleModal: toggleCotisationModal
    } = useYpModal();

    const {
        isOpen: isAdhesionOpen,
        toggleModal: toggleAdhesionModal
    } = useYpModal();

    const {
        isOpen: isMetaDataOpen,
        toggleModal: toggleMetaDataModal
    } = useYpModal();

    const {
        isOpen: isDeletionOpen,
        toggleModal: toggleDeletionModal
    } = useYpModal();

    const {
        data: tableRefIVO
    } = useTableReferenceDetailProvider({
        code: 'IVO'
    });

    const {
        ...multiDeleteWs
    } = useFicheMultiDelete();

    const adhesionColumns = useAdhesionsListDefinition({
        onOpenDetail: () => null
    });

    // Getters
    const getFicheTitle = (fiche: HistorisationModel | null): string => getValorisationValue(
        find(fiche?.valorisations, { property_key: find(squelettesList?.data, { numero: fiche?.fiche_type })?.code_dc_titre ?? '' })
    ) || fiche?.fiche_id || '-';

    const getPopulationsIncluses = (fiche: HistorisationModel | null): PopulationModel[] => filter(
        map(fiche?.populations_incluses, (id) => find(referencialContext?.referencial?.populations, { id })),
        (population) => !!population
    );

    const getPopulationsExclues = (fiche: HistorisationModel | null): PopulationModel[] => filter(
        map(fiche?.populations_exclues, (id) => find(referencialContext?.referencial?.populations, { id })),
        (population) => !!population
    );

    const getFicheCotisationTrigramme = (): string =>
        find(squelettesList?.data, { numero: cotisation?.fiche_type })?.trigramme ?? '';

    const getCurrentFicheAdhesion = (): HistorisationModel | null =>
        find(fichesList?.data, (fiche) => fiche.fiche_id === currentFicheId) ?? null;

    const getFichesAdhesionsIds = (): string[] => {
        const property_key = `${getFicheCotisationTrigramme()}Lien${capitalize(famille?.trigramme)}${capitalize(getFicheCotisationTrigramme())}`;

        return find(cotisation?.valorisations, { property_key })?.valeurs as string[] ?? [];
    };

    const getFichesAdhesions = (): HistorisationModel[] => {
        const fichesAdhesions = referencialContext?.referencial?.fiches?.[famille?.numero ?? 0]?.data;

        return orderBy(
            map(getFichesAdhesionsIds(), (fiche_id) => find(fichesAdhesions, { fiche_id })) as HistorisationModel[],
            ['debut_validite'], ['desc']
        );
    };

    const getFormattedValue = (valeur: string | null, dc: DonneeContextuelleModel): string | number | null => {
        switch (DonneeTypeEnum.code(dc.type)) {
        case 'Booleen':
            return valeur === 'true' ? 'Oui' : 'Non';
        case 'Numerique':
            return dc?.code?.includes('Taux')
                ? getFormattedDecimalDigits(
                    Number(valeur ?? 0), 4
                )
                : dc?.code?.includes('Montant')
                    ? getFormattedDecimalDigits(
                        Number(valeur ?? 0), 2
                    )
                    : valeur;
        default:
            return valeur;
        }
    };

    // Handlers
    const onSearch = useCallback((event: ChangeEvent<HTMLInputElement>): void =>
        setSearchText(event.target.value)
    , []);

    const onOpenMetaData = (fiche: HistorisationModel | null): void => {
        setCurrentFicheId(fiche?.fiche_id ?? null);
        toggleMetaDataModal();
    };

    const onOpenEditionAdhesion = (fiche: HistorisationModel | null): void => {
        setCurrentFicheId(fiche?.fiche_id ?? null);
        toggleAdhesionModal();
    };

    const onOpenDeleteConfirmation = (fiche: HistorisationModel | null): void => {
        setCurrentFicheId(fiche?.fiche_id ?? null);
        toggleDeletionModal();
    };

    const onCloseDeleteConfirmation = (): void => {
        setCurrentFicheId(null);
        toggleDeletionModal();
    };

    const adhesionsDataTable = useMemo(() =>
        orderBy(map(getFichesAdhesions(), (adhesion) => {
            const trigrammeAdhesion = famille?.trigramme ?? '';

            return {
                has_error: false,
                fiche: adhesion,
                famille_adhesion: famille,
                filter: adhesion?.fiche_type,
                is_referentiel: !!adhesion?.is_referentiel,
                validite_fin: getDateFormat(adhesion?.validite_fin),
                populations_incluses: getPopulationsIncluses(adhesion),
                validite_debut: getDateFormat(adhesion?.validite_debut),
                organisme: find(tableRefIVO?.data?.elements,
                    { code: find(adhesion?.valorisations, { property_key: `${trigrammeAdhesion}Organisme` })?.valeurs?.[0] }
                )?.libelle ?? '-',
                etablissement: getFicheTitle(find(
                    referencialContext?.referencial?.fiches?.[2]?.data,
                    { fiche_id:
                        find(adhesion?.valorisations, {
                            property_key: `${trigrammeAdhesion}Lien${capitalize(trigrammeAdhesion)}Eta`
                        })?.valeurs?.[0] ?? ''
                    }
                ) ?? null),
                actions: {
                    edit: {
                        title: 'Modifier l\'adhesion',
                        isHidden: false,
                        handler: () => onOpenEditionAdhesion(adhesion)
                    },
                    editMetaData: {
                        title: 'Modifier les informations générales',
                        isHidden: false,
                        handler: () => onOpenMetaData(adhesion)
                    },
                    delete: {
                        title: 'Supprimer',
                        isHidden: !!adhesion?.is_referentiel,
                        handler: () => onOpenDeleteConfirmation(adhesion)
                    },
                    duplicate: {
                        title: '',
                        isHidden: true,
                        handler: () => null
                    }
                }
            };
        }), ['has_error', 'famille_adhesion.libelle', 'is_referentiel', 'organisme', 'etablissement', 'validite_debut'],
        ['desc', 'asc', 'desc', 'asc', 'asc', 'asc']),
    [tableRefIVO?.isSuccess, fichesList?.data]);

    const adhesionsFilteredList = useSearch({
        searchText,
        ignoreLocation: true,
        listToSearch: adhesionsDataTable,
        keysToSearch: [
            'organisme',
            'etablissement',
            'validite_fin',
            'validite_debut',
            'famille_adhesion.libelle',
            'populations_incluses.code',
            'populations_incluses.libelle'
        ]
    });

    const adhesionsTable = useTable({
        data: adhesionsFilteredList ?? [],
        columns: adhesionColumns ?? [],
        initialState: {
            columnVisibility: { has_error: some(adhesionsFilteredList, (adhesion) => adhesion.has_error) }
        }
    });

    return (
        <YpElement className='flex flex-col h-full overflow-x-hidden overflow-y-auto w-full'>
            <FichePopulationsFormComponent
                fiche={ cotisation }
                fichesList={ fichesList }
                isOpen={ isPopulationsOpen }
                squelettesList={ squelettesList }
                toggleModal={ togglePopulationsModal }
            />
            <AdhesionFormComponent
                isOpen={ isAdhesionOpen }
                fichesList={ fichesList }
                toggleModal={ toggleAdhesionModal }
                trigramme={ famille?.trigramme ?? '' }
                adhesion={ {
                    ...getCurrentFicheAdhesion(),
                    date_application: max(map(getCurrentFicheAdhesion()?.valorisations, (valorisation) => valorisation.date_debut)) ?? null,
                    donnees_contextuelles: datas(
                        getCurrentFicheAdhesion()?.valorisations,
                        referencialContext?.referencial?.donneesContextuelles?.[getCurrentFicheAdhesion()?.fiche_type ?? 0] ?? []
                    )
                } }
            />
            <CotisationFormComponent
                fichesList={ fichesList }
                isOpen={ isCotisationOpen }
                toggleModal={ toggleCotisationModal }
                squeletteFicheList={ squelettesList }
                trigramme={ getFicheCotisationTrigramme() }
                cotisation={ {
                    ...cotisation,
                    date_application: max(map(cotisation?.valorisations, (valorisation) => valorisation.date_debut)) ?? null,
                    donnees_contextuelles: datas(
                        cotisation?.valorisations,
                        referencialContext?.referencial?.donneesContextuelles?.[cotisation?.fiche_type ?? 0] ?? []
                    )
                } }
            />
            <CotisationAdhesionsFormComponent
                famille={ famille }
                cotisation={ cotisation }
                fichesList={ fichesList }
                organismesList={ organismesList }
                squelettesList={ squelettesList }
                adhesions={ getFichesAdhesions() }
                type_cotisation={ type_cotisation }
                isOpen={ isCotisationAdhesionsOpen }
                toggleModal={ toggleCotisationAdhesionsModal }
            />
            <MetaDataModalComponent
                isOpen={ isMetaDataOpen }
                onDataReload={ () => null }
                onModalClose={ toggleMetaDataModal }
                title={ 'Modification des informations générales' }
                fiche={ find(fichesList?.data, (fiche) => fiche.fiche_id === currentFicheId ) }
            />
            <YpConfirmModal
                isOpen={ isDeletionOpen }
                // onValidation={ onDeleteValidation }
                onValidation={ () => null }
                onClose={ onCloseDeleteConfirmation }
                isLoading={ multiDeleteWs?.isLoading }
                // question={ `Êtes-vous sûr de vouloir supprimer "${getFicheTitle()}" ?` }
                question={ 'Êtes-vous sûr de vouloir supprimer "XXXXXX" ?' }
            />
            <YpElement className='flex flex-col flex-1 gap-y-4 p-2 pt-0'>
                <YpTag tagColor='neutral'>
                    <YpElement
                        className='flex items-center gap-x-2'
                        style={ { color: famille?.couleur as TTailwindColorPalette || undefined } }
                    >
                        <FontAwesomeIcon
                            size='sm'
                            icon={ famille?.icone as IconProp || undefined }
                        />
                        <YpElement className='font-text text-xs'>
                            { famille?.libelle }
                        </YpElement>
                    </YpElement>
                </YpTag>
                <YpElement className='flex gap-x-1 items-center'>
                    <YpTypography
                        size={ 14 }
                        weight='semibold'
                    >
                        { 'Populations' }
                    </YpTypography>
                    {
                        !cotisation?.is_referentiel && (
                            <YpButton
                                variant='text'
                                color='primary'
                                icon={ ['far', 'edit'] }
                                onClick={ togglePopulationsModal }
                            />
                        )
                    }
                </YpElement>
                <YpTable className='table-auto text-left'>
                    <YpTable.TBody>
                        <YpTable.Tr>
                            <YpTable.Th className='whitespace-nowrap'>
                                <YpTypography
                                    size={ 12 }
                                    color='neutral-500'
                                >
                                    { 'Incluses' }
                                </YpTypography>
                            </YpTable.Th>
                            <YpTable.Td className='flex flex-col gap-y-1 px-4 py-1'>
                                {
                                    getPopulationsIncluses(cotisation)?.length
                                        ? <YpTagsList
                                            tags={ map(getPopulationsIncluses(cotisation), (population) => ({
                                                id: `exc-${population.code}-${population.id}`,
                                                label: population.libelle
                                            })) }
                                            truncateLength={ 50 }
                                            truncateStyle='middle'
                                            tooltipPosition="bottom"
                                        />
                                        :
                                        <YpTypography
                                            size={ 12 }
                                            weight="medium"
                                            color="neutral-400"
                                        >
                                            { '-' }
                                        </YpTypography>
                                }
                            </YpTable.Td>
                        </YpTable.Tr>
                        <YpTable.Tr>
                            <YpTable.Th className='whitespace-nowrap'>
                                <YpTypography
                                    size={ 12 }
                                    color='neutral-500'
                                >
                                    { 'Exclues' }
                                </YpTypography>
                            </YpTable.Th>
                            <YpTable.Td className='flex flex-col gap-y-1 px-4 py-1'>
                                {
                                    getPopulationsExclues(cotisation)?.length
                                        ? <YpTagsList
                                            tags={ map(getPopulationsExclues(cotisation), (population) => ({
                                                id: `exc-${population.code}-${population.id}`,
                                                label: population.libelle
                                            })) }
                                            truncateLength={ 50 }
                                            truncateStyle='middle'
                                            tooltipPosition="bottom"
                                        />
                                        :
                                        <YpTypography
                                            size={ 12 }
                                            weight="medium"
                                            color="neutral-400"
                                        >
                                            { '-' }
                                        </YpTypography>
                                }
                            </YpTable.Td>
                        </YpTable.Tr>
                    </YpTable.TBody>
                </YpTable>
                <YpElement>
                    <YpTab variant="filter">
                        <YpTab.Item
                            title='Cotisation'
                            isActive={ currentTab === 'cotisation' }
                            onClick={ () => setCurrentTab('cotisation') }
                        />
                        <YpTab.Item
                            title={
                                conjugate(
                                    'Adhésion liée',
                                    getFichesAdhesionsIds()?.length,
                                    false,
                                    { replaceValue: 'Adhésions liées', string: 'Adhésion liée' }
                                )
                            }
                            isActive={ currentTab === 'adhesions' }
                            onClick={ () => setCurrentTab('adhesions') }
                            count={ getFichesAdhesionsIds()?.length ?? 0 }
                        />
                    </YpTab>
                </YpElement>
                {
                    currentTab === 'adhesions' && (
                        <YpElement className='flex items-center gap-2 w-full'>
                            <YpElement className='flex gap-2 justify-between w-full'>
                                <YpButton
                                    size='small'
                                    variant='text'
                                    color='primary'
                                    className='h-8'
                                    icon={ ['far', 'arrow-right-arrow-left'] }
                                    label={ 'Lier ou retirer' }
                                    onClick={ () => null }
                                />
                            </YpElement>
                            {
                                getFichesAdhesionsIds()?.length > 0 && (
                                    <YpInput
                                        type='text'
                                        value={ searchText }
                                        onChange={ onSearch }
                                        className='min-w-[300px]'
                                        placeholder='Rechercher ...'
                                        icon={ {
                                            style: 'far',
                                            name: 'search',
                                            position: 'left'
                                        } }
                                    />
                                )
                            }
                        </YpElement>
                    )
                }
                {
                    currentTab === 'cotisation'
                        ? (
                            <YpElement className='flex flex-col border border-neutral-300 divide-y divide-neutral-200 rounded-lg'>
                                <YpElement className='bg-brand-50 flex gap-x-4 justify-between items-center p-4 rounded-lg'>
                                    <YpElement className='flex gap-x-2 w-full items-center'>
                                        <img
                                            src={ picto }
                                            alt='picto-yeap'
                                            width={ '14px' }
                                            className={ cn({ 'hidden': !cotisation?.is_referentiel }) }
                                        />
                                        <YpTypography
                                            size={ 14 }
                                            weight='semibold'
                                            color='brand-700'
                                        >
                                            { getFicheTitle(cotisation) }
                                        </YpTypography>
                                    </YpElement>
                                    <YpMenu
                                        onOpenChange={ () => null }
                                        open={ false }
                                        trigger={
                                            <FontAwesomeIcon
                                                className='cursor-pointer text-neutral-500 hover:text-neutral-950 transition'
                                                icon={ ['far', 'ellipsis'] }
                                                size='lg'
                                            />
                                        }
                                    >
                                        {
                                            !cotisation?.is_referentiel && (
                                                <Fragment>
                                                    <YpMenu.Item
                                                        action={ toggleCotisationModal }
                                                        icon={ ['far', 'pen-to-square'] }
                                                        label={ 'Modifier la cotisation' }
                                                    />
                                                    <YpMenu.Item
                                                        action={ togglePopulationsModal }
                                                        icon={ ['far', 'pen-to-square'] }
                                                        label={ 'Modifier les informations générales' }
                                                    />
                                                </Fragment>
                                            )
                                        }
                                        {
                                            cotisation?.is_referentiel && (
                                                <YpMenu.Item
                                                    action={ () => null }
                                                    icon={ ['far', 'copy'] }
                                                    label={ 'Dupliquer' }
                                                />
                                            )
                                        }
                                        <YpMenu.Item
                                            action={ () => onOpenDeleteConfirmation(cotisation) }
                                            icon={ ['far', 'trash'] }
                                            label={ 'Supprimer' }
                                            accent='red'
                                        />
                                    </YpMenu>
                                </YpElement>
                                {
                                    map(
                                        filter(
                                            referencialContext?.referencial?.groupements?.[cotisation?.fiche_type ?? 0],
                                            (groupement) => groupement.libelle?.startsWith('Cotisation')
                                        ), (groupement, index) => (
                                            <YpElement
                                                key={ index }
                                                className='flex gap-4 items-center justify-between py-2 px-4'
                                            >
                                                <YpElement className='items-center gap-x-4 grid grid-cols-5 w-full'>
                                                    <YpTypography
                                                        size={ 12 }
                                                        color='neutral-600'
                                                        className='whitespace-nowrap'
                                                    >
                                                        { groupement?.libelle }
                                                    </YpTypography>
                                                    {
                                                        orderBy(map(
                                                            filter(
                                                                getDCByCodeGroupement(
                                                                    groupement.code,
                                                                    cotisation?.fiche_type ?? 0,
                                                                    referencialContext?.referencial
                                                                ),
                                                                (dc) => FieldVisibiliteEnum.code(dc.visibilite ?? 0) !== 'Cache'),
                                                            (dc, index) => {
                                                                const valeur = find(cotisation?.valorisations, {
                                                                    property_key: dc.code
                                                                })?.valeurs?.[0];

                                                                return (
                                                                    <YpElement
                                                                        key={ index }
                                                                        className='text-right whitespace-nowrap truncate'
                                                                    >
                                                                        <YpTypography size={ 12 }>
                                                                            { dc.libelle }
                                                                        </YpTypography>
                                                                        <YpTypography
                                                                            size={ 12 }
                                                                            weight='light'
                                                                        >
                                                                            { getFormattedValue(valeur ?? null, dc) ?? '-' }
                                                                        </YpTypography>
                                                                    </YpElement>
                                                                );
                                                            }
                                                        ), ['position'], ['asc'])
                                                    }
                                                </YpElement>
                                            </YpElement>
                                        )
                                    )
                                }
                                {
                                    filter(getDCByCodeGroupement(
                                        'Infos',
                                        cotisation?.fiche_type ?? 0,
                                        referencialContext?.referencial
                                    ), (dc) => FieldVisibiliteEnum.code(dc?.visibilite ?? 0) !== 'Cache')?.length > 0 && (
                                        <YpElement className='flex gap-x-4 items-center justify-between py-2 px-4'>
                                            <YpElement className='items-center gap-4 grid grid-cols-5 w-full'>
                                                <YpTypography
                                                    size={ 12 }
                                                    color='neutral-600'
                                                    className='whitespace-nowrap'
                                                >
                                                    {
                                                        find(referencialContext?.referencial?.groupements?.[cotisation?.fiche_type ?? 0], {
                                                            code: 'Infos'
                                                        })?.libelle ?? '-'
                                                    }
                                                </YpTypography>
                                                {
                                                    orderBy(
                                                        map(filter(
                                                            getDCByCodeGroupement(
                                                                'Infos',
                                                                cotisation?.fiche_type ?? 0,
                                                                referencialContext?.referencial
                                                            ), (dc) => FieldVisibiliteEnum.code(dc?.visibilite ?? 0) !== 'Cache'),
                                                        (dc, index) => (
                                                            <YpElement
                                                                key={ index }
                                                                className='text-right whitespace-nowrap truncate'
                                                            >
                                                                <YpTypography size={ 12 }>
                                                                    { dc?.libelle ?? '-' }
                                                                </YpTypography>
                                                                <YpTypography
                                                                    size={ 12 }
                                                                    weight='light'
                                                                >
                                                                    {
                                                                        getFormattedValue(
                                                                            find(cotisation?.valorisations, {
                                                                                property_key: dc.code
                                                                            })?.valeurs?.[0] ?? null,
                                                                            dc
                                                                        ) ?? '-'
                                                                    }
                                                                </YpTypography>
                                                            </YpElement>
                                                        )))

                                                }
                                            </YpElement>
                                        </YpElement>
                                    )
                                }
                                <YpElement className='flex items-center justify-between py-2 px-4'>
                                    <YpElement className='bg-neutral-100 flex gap-x-8 items-center px-4 py-2 rounded-lg'>
                                        <YpTypography
                                            size={ 12 }
                                            color='neutral-500'
                                        >
                                            { getDateFormat(cotisation?.validite_debut ?? '') }
                                        </YpTypography>
                                        <FontAwesomeIcon
                                            size='xs'
                                            icon={ ['far', 'arrow-right'] }
                                        />
                                        <YpTypography
                                            size={ 12 }
                                            color='neutral-500'
                                        >
                                            { getDateFormat(cotisation?.validite_fin ?? '') }
                                        </YpTypography>
                                    </YpElement>
                                </YpElement>
                            </YpElement>
                        )
                        : getFichesAdhesionsIds()?.length
                            ? <YpDataTable
                                isLoading={ false }
                                table={ adhesionsTable }
                                height='calc(100vh - 390px)'
                            />
                            : <YpElement className='border border-neutral-300 flex items-center justify-start h-14 p-4 rounded-lg w-full'>
                                <YpTypography
                                    size={ 12 }
                                    color='neutral-500'
                                >
                                    { 'Aucun adhésion liée' }
                                </YpTypography>
                            </YpElement>
                }
            </YpElement>
        </YpElement>
    );
};

export default CotisationDetailComponent;
