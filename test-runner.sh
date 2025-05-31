#!/bin/bash

# TidyJS Test Runner Script
# Ce script facilite l'exécution des tests avec différentes options

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'aide
show_help() {
    echo -e "${BLUE}TidyJS Test Runner${NC}"
    echo -e "${GREEN}Usage:${NC} ./test-runner.sh [command] [options]"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo "  all         Exécute tous les tests"
    echo "  parser      Exécute uniquement les tests du parser"
    echo "  watch       Lance les tests en mode watch"
    echo "  coverage    Exécute les tests avec couverture de code"
    echo "  file        Exécute les tests d'un fichier spécifique"
    echo "  pattern     Exécute les tests matchant un pattern"
    echo "  clean       Nettoie le cache Jest"
    echo "  help        Affiche cette aide"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  -v, --verbose    Mode verbose"
    echo "  -u, --update     Met à jour les snapshots"
    echo ""
    echo -e "${YELLOW}Exemples:${NC}"
    echo "  ./test-runner.sh all"
    echo "  ./test-runner.sh parser"
    echo "  ./test-runner.sh file test/parser/ast-parsing.test.ts"
    echo "  ./test-runner.sh pattern \"import detection\""
    echo "  ./test-runner.sh coverage"
}

# Vérification des dépendances
check_deps() {
    echo -e "${BLUE}Vérification des dépendances...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js n'est pas installé!${NC}"
        exit 1
    fi
    
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installation des dépendances...${NC}"
        npm install
    fi
    
    # Compilation TypeScript si nécessaire
    if [ ! -d "dist" ] || [ -n "$(find src -newer dist -name '*.ts' 2>/dev/null)" ]; then
        echo -e "${YELLOW}Compilation du code...${NC}"
        npm run compile
    fi
}

# Exécution de tous les tests
run_all_tests() {
    echo -e "${BLUE}Exécution de tous les tests...${NC}"
    npm run test:unit "$@"
}

# Tests du parser uniquement
run_parser_tests() {
    echo -e "${BLUE}Exécution des tests du parser...${NC}"
    jest test/parser --config jest.config.js "$@"
}

# Mode watch
run_watch() {
    echo -e "${BLUE}Lancement des tests en mode watch...${NC}"
    jest --watch --config jest.config.js "$@"
}

# Tests avec couverture
run_coverage() {
    echo -e "${BLUE}Exécution des tests avec couverture...${NC}"
    jest --coverage --config jest.config.js "$@"
    
    # Affiche le résumé de la couverture
    if [ -f "coverage/lcov-report/index.html" ]; then
        echo -e "${GREEN}Rapport de couverture généré dans coverage/lcov-report/index.html${NC}"
    fi
}

# Test d'un fichier spécifique
run_file_test() {
    local file=$1
    shift
    
    if [ -z "$file" ]; then
        echo -e "${RED}Erreur: Veuillez spécifier un fichier${NC}"
        echo "Usage: ./test-runner.sh file <chemin/vers/fichier.test.ts>"
        exit 1
    fi
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}Erreur: Le fichier '$file' n'existe pas${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Exécution des tests pour: $file${NC}"
    jest "$file" --config jest.config.js "$@"
}

# Test par pattern
run_pattern_test() {
    local pattern=$1
    shift
    
    if [ -z "$pattern" ]; then
        echo -e "${RED}Erreur: Veuillez spécifier un pattern${NC}"
        echo "Usage: ./test-runner.sh pattern \"nom du test\""
        exit 1
    fi
    
    echo -e "${BLUE}Exécution des tests matchant: '$pattern'${NC}"
    jest -t "$pattern" --config jest.config.js "$@"
}

# Nettoyage du cache
clean_cache() {
    echo -e "${BLUE}Nettoyage du cache Jest...${NC}"
    jest --clearCache
    echo -e "${GREEN}Cache nettoyé!${NC}"
}

# Vérification du type check avant les tests
type_check() {
    echo -e "${BLUE}Vérification des types TypeScript...${NC}"
    npm run check-types
}

# Main
main() {
    local command=${1:-help}
    shift || true
    
    # Options globales
    local verbose=""
    local update_snapshots=""
    local remaining_args=()
    
    # Parse des options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                verbose="--verbose"
                shift
                ;;
            -u|--update)
                update_snapshots="--updateSnapshot"
                shift
                ;;
            *)
                remaining_args+=("$1")
                shift
                ;;
        esac
    done
    
    # Ajout des options globales
    if [ -n "$verbose" ]; then
        remaining_args+=("$verbose")
    fi
    if [ -n "$update_snapshots" ]; then
        remaining_args+=("$update_snapshots")
    fi
    
    case $command in
        all)
            check_deps
            type_check
            run_all_tests "${remaining_args[@]}"
            ;;
        parser)
            check_deps
            run_parser_tests "${remaining_args[@]}"
            ;;
        watch)
            check_deps
            run_watch "${remaining_args[@]}"
            ;;
        coverage)
            check_deps
            type_check
            run_coverage "${remaining_args[@]}"
            ;;
        file)
            check_deps
            run_file_test "${remaining_args[@]}"
            ;;
        pattern)
            check_deps
            run_pattern_test "${remaining_args[@]}"
            ;;
        clean)
            clean_cache
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}Commande inconnue: $command${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Exécution
main "$@"