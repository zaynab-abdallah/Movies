import React from "react";
import search from './assets/images/search.svg'



const Search = ({searchTerm,setSearchTerm}) => {
    
    return (
    <div className="search">
        <div>
       
        <img src={search} alt="search" />

        <input
            type="text"
            placeholder="Search through thousands of movies"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
        />
        </div>
        </div>
    );
};

export default Search;
